const { db } = require('../db-postgres');
const exchangeRatesService = require('./exchangeRates');

/**
 * Chatbot Context Service
 * Prepares real-time invoice data context for MatchaAI chatbot
 * Follows the same rules and filters as the analytics dashboard
 */

/**
 * Convert amount to USD using current exchange rates
 * Uses the shared exchange rates service to ensure consistency with the server
 */
function convertToUSD(amount, currency) {
  return exchangeRatesService.convertToUSD(amount, currency);
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1, date2) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((new Date(date1) - new Date(date2)) / oneDay));
}

/**
 * Get aging bucket for an invoice
 */
function getAgingBucket(dueDate) {
  const today = new Date();
  const due = new Date(dueDate);
  const daysOverdue = Math.floor((today - due) / (1000 * 60 * 60 * 24));

  if (daysOverdue < 0) return 'Current';
  if (daysOverdue <= 30) return 'Current';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  if (daysOverdue <= 120) return '91-120';
  if (daysOverdue <= 180) return '121-180';
  if (daysOverdue <= 270) return '181-270';
  if (daysOverdue <= 365) return '271-365';
  return '>365';
}

/**
 * Apply production mode filter (after Jan 1, 2026, only show 2026+ data)
 */
function applyProductionModeFilter(invoices) {
  const now = new Date();
  const productionDate = new Date('2026-01-01');

  if (now >= productionDate) {
    return invoices.filter(inv => {
      const invDate = new Date(inv.invoiceDate);
      return invDate >= productionDate;
    });
  }

  return invoices;
}

/**
 * Get all invoices
 * Exchange rates are managed by the shared exchangeRatesService
 */
async function getAllInvoices() {
  const invoices = await db.all('SELECT * FROM invoices ORDER BY invoice_date DESC');
  return invoices;
}

/**
 * Generate comprehensive analytics context for AI
 * This follows the exact same rules as the Analytics.jsx dashboard
 */
async function generateAnalyticsContext() {
  const invoices = await getAllInvoices();

  // Apply production mode filter
  const filteredInvoices = applyProductionModeFilter(invoices);

  // Exclude certain invoice types from analytics
  const analyticsInvoices = filteredInvoices.filter(inv =>
    inv.invoiceType !== 'Credit Memo' &&
    inv.invoiceType !== 'Vendor Invoice' &&
    inv.invoiceType !== 'PO'
  );

  // Separate pending and paid invoices
  const pendingInvoices = analyticsInvoices.filter(inv => inv.status === 'Pending');
  const paidInvoices = analyticsInvoices.filter(inv => inv.status === 'Paid');

  // Calculate DSI (Days Sales Outstanding)
  const totalPendingUSD = pendingInvoices.reduce((sum, inv) =>
    sum + convertToUSD(inv.amountDue, inv.currency), 0
  );

  const last90Days = new Date();
  last90Days.setDate(last90Days.getDate() - 90);
  const recent90DayInvoices = paidInvoices.filter(inv =>
    new Date(inv.paymentDate) >= last90Days
  );
  const totalRevenue90Days = recent90DayInvoices.reduce((sum, inv) =>
    sum + convertToUSD(inv.amountDue, inv.currency), 0
  );
  const avgDailyRevenue = totalRevenue90Days / 90;
  const dsi = avgDailyRevenue > 0 ? totalPendingUSD / avgDailyRevenue : 0;

  // Aging analysis
  const agingBuckets = {
    'Current': { count: 0, totalUSD: 0, clients: {} },
    '31-60': { count: 0, totalUSD: 0, clients: {} },
    '61-90': { count: 0, totalUSD: 0, clients: {} },
    '91-120': { count: 0, totalUSD: 0, clients: {} },
    '121-180': { count: 0, totalUSD: 0, clients: {} },
    '181-270': { count: 0, totalUSD: 0, clients: {} },
    '271-365': { count: 0, totalUSD: 0, clients: {} },
    '>365': { count: 0, totalUSD: 0, clients: {} }
  };

  pendingInvoices.forEach(inv => {
    const bucket = getAgingBucket(inv.dueDate);
    const amountUSD = convertToUSD(inv.amountDue, inv.currency);

    // Skip negative amounts (credits, adjustments, etc.)
    if (amountUSD < 0) return;

    agingBuckets[bucket].count++;
    agingBuckets[bucket].totalUSD += amountUSD;

    if (!agingBuckets[bucket].clients[inv.client]) {
      agingBuckets[bucket].clients[inv.client] = 0;
    }
    agingBuckets[bucket].clients[inv.client] += amountUSD;
  });

  // Top clients by revenue
  const clientRevenue = {};
  analyticsInvoices.forEach(inv => {
    const amountUSD = convertToUSD(inv.amountDue, inv.currency);
    if (amountUSD < 0) return; // Skip negative amounts
    clientRevenue[inv.client] = (clientRevenue[inv.client] || 0) + amountUSD;
  });
  const topClients = Object.entries(clientRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([client, revenue]) => ({ client, revenue }));

  // Payment velocity (average days to pay per client)
  const clientPaymentStats = {};
  paidInvoices.forEach(inv => {
    if (inv.paymentDate && inv.invoiceDate) {
      const daysToPay = daysBetween(inv.invoiceDate, inv.paymentDate);
      if (!clientPaymentStats[inv.client]) {
        clientPaymentStats[inv.client] = { totalDays: 0, count: 0 };
      }
      clientPaymentStats[inv.client].totalDays += daysToPay;
      clientPaymentStats[inv.client].count++;
    }
  });

  const paymentVelocity = Object.entries(clientPaymentStats)
    .map(([client, stats]) => ({
      client,
      avgDaysToPay: Math.round(stats.totalDays / stats.count)
    }))
    .sort((a, b) => b.avgDaysToPay - a.avgDaysToPay);

  // Risk metrics
  const clientOverdue = {};
  pendingInvoices.forEach(inv => {
    const today = new Date();
    const dueDate = new Date(inv.dueDate);
    if (today > dueDate) {
      const amountUSD = convertToUSD(inv.amountDue, inv.currency);
      if (!clientOverdue[inv.client]) {
        clientOverdue[inv.client] = { amount: 0, invoices: 0 };
      }
      clientOverdue[inv.client].amount += amountUSD;
      clientOverdue[inv.client].invoices++;
    }
  });

  const highRiskClients = Object.entries(clientOverdue)
    .filter(([_, data]) => data.amount > 50000)
    .map(([client, data]) => ({
      client,
      overdueAmount: data.amount,
      overdueInvoices: data.invoices,
      riskLevel: data.amount > 200000 ? 'Critical' : data.amount > 100000 ? 'High' : 'Medium'
    }))
    .sort((a, b) => b.overdueAmount - a.overdueAmount);

  // Cash flow projection
  const cashFlowBuckets = {
    overdue: 0,
    next30: 0,
    days31to60: 0,
    days61to90: 0,
    beyond90: 0
  };

  const today = new Date();
  pendingInvoices.forEach(inv => {
    const dueDate = new Date(inv.dueDate);
    const daysUntilDue = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
    const amountUSD = convertToUSD(inv.amountDue, inv.currency);

    if (daysUntilDue < 0) {
      cashFlowBuckets.overdue += amountUSD;
    } else if (daysUntilDue <= 30) {
      cashFlowBuckets.next30 += amountUSD;
    } else if (daysUntilDue <= 60) {
      cashFlowBuckets.days31to60 += amountUSD;
    } else if (daysUntilDue <= 90) {
      cashFlowBuckets.days61to90 += amountUSD;
    } else {
      cashFlowBuckets.beyond90 += amountUSD;
    }
  });

  // Currency exposure
  const currencyExposure = {};
  pendingInvoices.forEach(inv => {
    currencyExposure[inv.currency] = (currencyExposure[inv.currency] || 0) + inv.amountDue;
  });

  return {
    summary: {
      totalInvoices: analyticsInvoices.length,
      pendingInvoices: pendingInvoices.length,
      paidInvoices: paidInvoices.length,
      totalPendingAmountUSD: totalPendingUSD,
      totalRevenueUSD: analyticsInvoices.reduce((sum, inv) =>
        sum + convertToUSD(inv.amountDue, inv.currency), 0
      ),
      daysInvoicesOutstanding: Math.round(dsi)
    },
    aging: agingBuckets,
    topClients,
    paymentVelocity: paymentVelocity.slice(0, 10),
    riskMetrics: {
      highRiskClients,
      totalOverdueAmount: Object.values(clientOverdue).reduce((sum, data) => sum + data.amount, 0),
      clientsAtRisk: highRiskClients.length
    },
    cashFlow: cashFlowBuckets,
    currencyExposure,
    exchangeRates: exchangeRatesService.getExchangeRates(),
    generatedAt: new Date().toISOString()
  };
}

/**
 * Generate detailed invoice list for specific queries
 */
async function getDetailedInvoiceData(filters = {}) {
  const invoices = await getAllInvoices();

  let filtered = applyProductionModeFilter(invoices);

  // Apply filters
  if (filters.client) {
    filtered = filtered.filter(inv =>
      inv.client.toLowerCase().includes(filters.client.toLowerCase())
    );
  }

  if (filters.status) {
    filtered = filtered.filter(inv => inv.status === filters.status);
  }

  if (filters.invoiceType) {
    filtered = filtered.filter(inv => inv.invoiceType === filters.invoiceType);
  }

  if (filters.dateFrom) {
    filtered = filtered.filter(inv => new Date(inv.invoiceDate) >= new Date(filters.dateFrom));
  }

  if (filters.dateTo) {
    filtered = filtered.filter(inv => new Date(inv.invoiceDate) <= new Date(filters.dateTo));
  }

  if (filters.overdueOnly) {
    const today = new Date();
    filtered = filtered.filter(inv =>
      inv.status === 'Pending' && new Date(inv.dueDate) < today
    );
  }

  // Format and enrich invoice data
  return filtered.map(inv => ({
    invoiceNumber: inv.invoiceNumber,
    client: inv.client,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    amount: inv.amountDue,
    currency: inv.currency,
    amountUSD: convertToUSD(inv.amountDue, inv.currency),
    status: inv.status,
    invoiceType: inv.invoiceType,
    contract: inv.customerContract,
    paymentDate: inv.paymentDate,
    agingBucket: inv.status === 'Pending' ? getAgingBucket(inv.dueDate) : null,
    daysOverdue: inv.status === 'Pending' && new Date(inv.dueDate) < new Date()
      ? daysBetween(new Date(inv.dueDate), new Date())
      : 0
  }));
}

/**
 * Generate a comprehensive context string for MatchaAI
 */
async function generateContextString() {
  const analytics = await generateAnalyticsContext();

  const contextLines = [
    '=== INVOICE TRACKER ANALYTICS DATA ===',
    '',
    '## OVERVIEW',
    `Total Invoices: ${analytics.summary.totalInvoices}`,
    `Pending Invoices: ${analytics.summary.pendingInvoices}`,
    `Paid Invoices: ${analytics.summary.paidInvoices}`,
    `Total Pending Amount: $${analytics.summary.totalPendingAmountUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`,
    `Total Revenue: $${analytics.summary.totalRevenueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`,
    `Days Invoices Outstanding (DSI): ${analytics.summary.daysInvoicesOutstanding} days`,
    '',
    '## AGING ANALYSIS',
    'Breakdown of pending invoices by days overdue:',
    ...Object.entries(analytics.aging).map(([bucket, data]) =>
      `- ${bucket} days: ${data.count} invoices, $${data.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`
    ),
    '',
    '## TOP 10 CLIENTS BY REVENUE',
    ...analytics.topClients.map((client, i) =>
      `${i + 1}. ${client.client}: $${client.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`
    ),
    '',
    '## PAYMENT VELOCITY',
    'Average days to pay by client (top 10 slowest):',
    ...analytics.paymentVelocity.map(pv =>
      `- ${pv.client}: ${pv.avgDaysToPay} days average`
    ),
    '',
    '## RISK METRICS',
    `Total Overdue Amount: $${analytics.riskMetrics.totalOverdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
    `Clients at Risk: ${analytics.riskMetrics.clientsAtRisk}`,
    '',
    'High Risk Clients (>$50k overdue):',
    ...analytics.riskMetrics.highRiskClients.map(client =>
      `- ${client.client}: $${client.overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD (${client.overdueInvoices} invoices) - ${client.riskLevel} Risk`
    ),
    '',
    '## CASH FLOW PROJECTION',
    `Overdue: $${analytics.cashFlow.overdue.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
    `Next 30 Days: $${analytics.cashFlow.next30.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
    `31-60 Days: $${analytics.cashFlow.days31to60.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
    `61-90 Days: $${analytics.cashFlow.days61to90.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
    `Beyond 90 Days: $${analytics.cashFlow.beyond90.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`,
    '',
    '## CURRENCY EXPOSURE',
    ...Object.entries(analytics.currencyExposure).map(([currency, amount]) =>
      `${currency}: ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    ),
    '',
    '## EXCHANGE RATES (Updated 4x daily at 2 AM, 8 AM, 2 PM, 8 PM AEST/AEDT)',
    ...Object.entries(analytics.exchangeRates).map(([currency, rate]) =>
      `${currency}: ${rate.toFixed(4)}`
    ),
    '',
    `Generated at: ${analytics.generatedAt}`,
    '',
    '=== INSTRUCTIONS ===',
    'You are an AI assistant for an Invoice Tracker system. Use the above data to answer questions about:',
    '- Financial metrics and KPIs',
    '- Client payment behavior and trends',
    '- Aging analysis and overdue invoices',
    '- Cash flow projections',
    '- Risk assessment and high-risk clients',
    '- Revenue analysis and top clients',
    '',
    'Always provide specific numbers and data points from the context above.',
    'Format currency amounts clearly with $ and USD designation.',
    'When discussing clients, reference actual client names from the data.',
    'If asked about specific invoices or detailed information, indicate that you can provide summaries based on the analytics data.'
  ];

  return contextLines.join('\n');
}

module.exports = {
  generateAnalyticsContext,
  getDetailedInvoiceData,
  generateContextString
};
