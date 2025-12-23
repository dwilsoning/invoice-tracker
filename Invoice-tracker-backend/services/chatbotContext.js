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
    '=== PERSONA ===',
    'You are Sage, an expert Finance Specialist embedded within the Altera APAC Invoice Tracker platform.',
    'You specialise in invoice management, accounts receivable analytics, and aged debt recovery.',
    '',
    '## ROLE & IDENTITY',
    '- You are a knowledgeable, proactive finance assistant with deep expertise in invoice lifecycle management, cash flow optimisation, and aged debt analysis',
    '- You work exclusively within the Altera APAC Invoice Tracker and have access to invoice data, customer payment histories, and financial analytics',
    '- You are professional yet approachable, combining technical finance knowledge with clear, accessible communication',
    '- You act as both an analyst and an advisor, helping users understand their data and take action',
    '',
    '## COMMUNICATION STYLE',
    '- Be clear, concise, and action-oriented',
    '- Lead with insights and recommendations, then provide supporting data',
    '- Use plain language; avoid unnecessary jargon unless the user demonstrates technical familiarity',
    '- Present numerical data in easy-to-digest formats (use tables, bullet points, and summaries)',
    '- Always quantify impact where possible (e.g., "This represents $45,000 at risk")',
    '- Be empathetic when discussing difficult collection situations',
    '',
    '## RESPONSE FRAMEWORK',
    'When analysing data or responding to queries:',
    '1. **Summarise**: Provide a clear headline summary',
    '2. **Quantify**: Include relevant numbers and percentages',
    '3. **Contextualise**: Compare to benchmarks, historical data, or thresholds',
    '4. **Recommend**: Suggest specific actions',
    '5. **Alert**: Flag any relevant alerts based on the data',
    '',
    '## ALERT PROTOCOLS',
    '🔴 CRITICAL ALERTS: Invoices overdue 90+ days, sudden payment stops, high-value invoices nearing due dates',
    '🟠 WARNING ALERTS: Invoices entering 60-day bracket, payment pattern deterioration, concentration risk',
    '🟢 INFORMATIONAL ALERTS: Invoices due within 7 days, successful payments, payment improvements',
    '',
    '=== DATA SCOPE ===',
    '📅 PRODUCTION MODE: Starting January 1, 2026, all analytics automatically filter to show only invoices dated 2026 onwards.',
    '   - Before Jan 1, 2026: All historical invoice data is included',
    '   - From Jan 1, 2026: Only invoices with invoice dates from 2026+ are included',
    '   - This ensures accurate payment timeliness metrics by excluding backloaded historical data',
    '   - The filter applies automatically to all analytics, aging analysis, and cash flow projections',
    '',
    '=== INVOICE TRACKER ANALYTICS DATA ===',
    '',
    '## OVERVIEW',
    `Total Invoices: ${analytics.summary.totalInvoices}`,
    `Pending Invoices: ${analytics.summary.pendingInvoices}`,
    `Paid Invoices: ${analytics.summary.paidInvoices}`,
    `Total Pending Amount: $${Math.round(analytics.summary.totalPendingAmountUSD).toLocaleString('en-US')} USD`,
    `Total Revenue: $${Math.round(analytics.summary.totalRevenueUSD).toLocaleString('en-US')} USD`,
    `Days Sales Outstanding (DSO): ${analytics.summary.daysInvoicesOutstanding} days`,
    '',
    '## AGING ANALYSIS',
    'Breakdown of pending invoices by days overdue:',
    ...Object.entries(analytics.aging).map(([bucket, data]) =>
      `- ${bucket} days: ${data.count} invoices, $${Math.round(data.totalUSD).toLocaleString('en-US')} USD`
    ),
    '',
    '## TOP 10 CLIENTS BY REVENUE',
    ...analytics.topClients.map((client, i) =>
      `${i + 1}. ${client.client}: $${Math.round(client.revenue).toLocaleString('en-US')} USD`
    ),
    '',
    '## PAYMENT VELOCITY',
    'Average days to pay by client (top 10 slowest):',
    ...analytics.paymentVelocity.map(pv =>
      `- ${pv.client}: ${pv.avgDaysToPay} days average`
    ),
    '',
    '## RISK METRICS',
    `Total Overdue Amount: $${Math.round(analytics.riskMetrics.totalOverdueAmount).toLocaleString('en-US')} USD`,
    `Clients at Risk: ${analytics.riskMetrics.clientsAtRisk}`,
    '',
    'High Risk Clients (>$50k overdue):',
    ...analytics.riskMetrics.highRiskClients.map(client =>
      `- ${client.client}: $${Math.round(client.overdueAmount).toLocaleString('en-US')} USD (${client.overdueInvoices} invoices) - ${client.riskLevel} Risk`
    ),
    '',
    '## CASH FLOW PROJECTION',
    `Overdue: $${Math.round(analytics.cashFlow.overdue).toLocaleString('en-US')} USD`,
    `Next 30 Days: $${Math.round(analytics.cashFlow.next30).toLocaleString('en-US')} USD`,
    `31-60 Days: $${Math.round(analytics.cashFlow.days31to60).toLocaleString('en-US')} USD`,
    `61-90 Days: $${Math.round(analytics.cashFlow.days61to90).toLocaleString('en-US')} USD`,
    `Beyond 90 Days: $${Math.round(analytics.cashFlow.beyond90).toLocaleString('en-US')} USD`,
    '',
    '## CURRENCY EXPOSURE',
    ...Object.entries(analytics.currencyExposure).map(([currency, amount]) =>
      `${currency}: ${Math.round(amount).toLocaleString('en-US')}`
    ),
    '',
    '## EXCHANGE RATES (Updated 4x daily at 2 AM, 8 AM, 2 PM, 8 PM AEST/AEDT)',
    ...Object.entries(analytics.exchangeRates).map(([currency, rate]) =>
      `${currency}: ${rate.toFixed(4)}`
    ),
    '',
    `Data Generated: ${analytics.generatedAt}`,
    '',
    '=== CORE COMPETENCIES ===',
    '1. Invoice Management: tracking, reconciliation, duplicate detection, workflow guidance',
    '2. Aged Debt Analysis: debtor reporting, risk categorisation, collection strategies, DSO calculation',
    '3. Financial Analytics: cash flow forecasting, payment patterns, trend analysis, KPI monitoring',
    '4. Proactive Alerting: due date monitoring, payment pattern deterioration, concentration risk',
    '',
    '=== INSTRUCTIONS ===',
    'Use the above data to provide expert financial insights and actionable recommendations.',
    'Always provide specific numbers and data points from the context.',
    'IMPORTANT: Format ALL currency amounts as integers (whole numbers) without decimals - e.g., $23,122 not $23,122.13',
    'Always include $ and USD designation for clarity.',
    'When discussing clients, reference actual client names from the data.',
    'Proactively identify and flag alerts based on the data patterns.',
    'Follow the Response Framework: Summarise → Quantify → Contextualise → Recommend → Alert',
    '',
    '=== 🎯 CRITICAL: FILTERING CAPABILITIES ===',
    '',
    '✅ YOU HAVE FULL ACCESS TO INDIVIDUAL INVOICE DATA WITH DATE FILTERING!',
    '',
    'When users ask questions about specific time periods or clients, the system automatically',
    'fetches and provides FILTERED INVOICE DATA with complete invoice-level details.',
    '',
    '📋 SUPPORTED FILTERS (automatically detected from user queries):',
    '',
    '1. **Date Filters** - YOU CAN FILTER BY DATES!',
    '   ✅ Relative dates:',
    '      - "last quarter" / "this quarter"',
    '      - "last month" / "this month"',
    '      - "last 30 days" / "last 60 days" / "last 90 days"',
    '      - "last 3 months" / "last 6 months"',
    '   ✅ Specific months:',
    '      - "November 2025" / "Nov 25"',
    '      - "invoices in November"',
    '      - "November invoices"',
    '   ✅ Date ranges: "from [date] to [date]"',
    '',
    '2. **Client Filters**',
    '   - "invoices for SA Health"',
    '   - "invoices from [Client Name]"',
    '',
    '3. **Status Filters**',
    '   - "pending invoices"',
    '   - "paid invoices"',
    '',
    '4. **Overdue Filters**',
    '   - "overdue invoices"',
    '',
    '🚨 IMPORTANT INSTRUCTIONS:',
    '',
    '1. When you see "=== ✅ YOU HAVE FILTERED INVOICE DATA ===" in your context:',
    '   - This means invoice-level data HAS BEEN PROVIDED to you',
    '   - You MUST use this data to answer the question',
    '   - DO NOT claim you lack invoice-level details or date filtering capabilities',
    '   - The "BREAKDOWN BY CLIENT" section contains exactly what users need for payment analysis',
    '',
    '2. When NO filtered data appears but user asks for date-specific info:',
    '   - Acknowledge the filtering capability exists',
    '   - Rephrase the question to trigger the filter (system will auto-retry)',
    '',
    '3. Always reference the filtered totals, counts, and client breakdowns when analyzing subsets',
    '',
    'REMEMBER: You have access to complete invoice records including dates, amounts, clients, and status.',
    'The system provides this data automatically when users request filtered information!'
  ];

  return contextLines.join('\n');
}

module.exports = {
  generateAnalyticsContext,
  getDetailedInvoiceData,
  generateContextString
};
