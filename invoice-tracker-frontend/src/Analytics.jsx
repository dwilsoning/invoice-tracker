import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const API_URL = 'http://localhost:3001/api';

// Format large numbers with k/m suffix
const formatNumber = (num) => {
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(1)}m`;
  } else if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}k`;
  }
  return `$${num.toFixed(0)}`;
};

// Format number for axis (no $ sign)
const formatAxisNumber = (num) => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}m`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(0)}k`;
  }
  return num.toFixed(0);
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
        <p className="font-semibold text-gray-800 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {formatNumber(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Analytics = ({ onNavigateBack }) => {
  const [invoices, setInvoices] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({
    USD: 1,
    AUD: 0.65,
    EUR: 1.08,
    GBP: 1.27,
    SGD: 0.74
  });
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  // Automatically enable production mode after Nov 1, 2025
  const [productionMode, setProductionMode] = useState(new Date() >= new Date('2025-11-01'));

  // Load invoices and exchange rates from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [invoicesResponse, ratesResponse] = await Promise.all([
          axios.get(`${API_URL}/invoices`),
          axios.get(`${API_URL}/exchange-rates`)
        ]);
        setInvoices(invoicesResponse.data);
        setExchangeRates(ratesResponse.data);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Convert currency to USD
  const convertToUSD = (amount, currency) => {
    return amount * (exchangeRates[currency] || 1);
  };

  // Base filter - applies production mode filter only
  const getBaseFilteredInvoices = () => {
    let filtered = [...invoices];

    // Exclude credit memos from all analytics calculations
    filtered = filtered.filter(inv => inv.invoiceType !== 'Credit Memo');

    // Production mode filter - only show invoices from 1 Nov 2025 onwards
    if (productionMode) {
      const productionStartDate = '2025-11-01';
      filtered = filtered.filter(inv => inv.invoiceDate >= productionStartDate);
    }

    return filtered;
  };

  // Get filtered invoices based on date range (applies on top of base filter)
  const getFilteredInvoices = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    let filtered = getBaseFilteredInvoices();

    if (dateFilter === 'year') {
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;
      filtered = filtered.filter(inv => inv.invoiceDate >= yearStart && inv.invoiceDate <= yearEnd);
    } else if (dateFilter === 'allTime') {
      // No filtering beyond production mode
    } else if (dateFilter === 'custom') {
      if (customFrom) {
        filtered = filtered.filter(inv => inv.invoiceDate >= customFrom);
      }
      if (customTo) {
        filtered = filtered.filter(inv => inv.invoiceDate <= customTo);
      }
    }

    return filtered;
  };

  const baseFilteredInvoices = getBaseFilteredInvoices(); // For calculations that need all production data
  const filteredInvoices = getFilteredInvoices(); // For calculations that respect date range filter

  // 1. DSI (Days Invoices Outstanding) Calculation
  const calculateDSI = () => {
    const pendingInvoices = baseFilteredInvoices.filter(inv => inv.status === 'Pending');
    const totalReceivables = pendingInvoices.reduce((sum, inv) =>
      sum + convertToUSD(inv.amountDue, inv.currency), 0);

    const today = new Date();
    const last90Days = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    const last90DaysStr = last90Days.toISOString().split('T')[0];

    const recentRevenue = baseFilteredInvoices
      .filter(inv => inv.invoiceDate >= last90DaysStr)
      .reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

    const avgDailyRevenue = recentRevenue / 90;
    const dsi = avgDailyRevenue > 0 ? totalReceivables / avgDailyRevenue : 0;

    return Math.round(dsi);
  };

  // DSI Trend over time (last 6 months)
  const getDSITrend = () => {
    const months = [];
    const today = new Date();
    const productionStartDate = productionMode ? '2025-11-01' : null;

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = monthDate.toISOString().substring(0, 7);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0];

      // Skip months before production start date when in production mode
      if (productionStartDate && monthStr < productionStartDate.substring(0, 7)) {
        continue;
      }

      // Get invoices up to this month
      const invoicesUpToMonth = baseFilteredInvoices.filter(inv => inv.invoiceDate <= monthEnd);
      const pendingAtMonth = invoicesUpToMonth.filter(inv => inv.status === 'Pending' ||
        (inv.status === 'Paid' && inv.paymentDate > monthEnd));

      const receivables = pendingAtMonth.reduce((sum, inv) =>
        sum + convertToUSD(inv.amountDue, inv.currency), 0);

      const last90DaysFromMonth = new Date(monthDate.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const revenue90Days = invoicesUpToMonth
        .filter(inv => inv.invoiceDate >= last90DaysFromMonth && inv.invoiceDate <= monthEnd)
        .reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

      const avgDaily = revenue90Days / 90;
      const dsi = avgDaily > 0 ? receivables / avgDaily : 0;

      months.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        dsi: Math.round(dsi)
      });
    }

    return months;
  };

  // 2. Aging Trend Chart (last 6 months)
  const getAgingTrend = () => {
    const months = [];
    const today = new Date();
    const productionStartDate = productionMode ? '2025-11-01' : null;

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = monthDate.toISOString().substring(0, 7);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0];

      // Skip months before production start date when in production mode
      if (productionStartDate && monthEnd < productionStartDate) {
        continue;
      }

      const pendingAtMonth = baseFilteredInvoices.filter(inv =>
        inv.status === 'Pending' || (inv.status === 'Paid' && inv.paymentDate > monthEnd)
      );

      let current = 0, days30 = 0, days60 = 0, days90 = 0, days90Plus = 0;

      pendingAtMonth.forEach(inv => {
        if (!inv.dueDate) return;

        const daysOverdue = Math.floor((new Date(monthEnd) - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24));
        const amount = convertToUSD(inv.amountDue, inv.currency);

        if (daysOverdue < 0 || daysOverdue <= 30) {
          current += amount;
        } else if (daysOverdue <= 60) {
          days30 += amount;
        } else if (daysOverdue <= 90) {
          days60 += amount;
        } else if (daysOverdue <= 120) {
          days90 += amount;
        } else {
          days90Plus += amount;
        }
      });

      months.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        'Current': Math.round(current),
        '31-60': Math.round(days30),
        '61-90': Math.round(days60),
        '91-120': Math.round(days90),
        '120+': Math.round(days90Plus)
      });
    }

    return months;
  };

  // 3. Top 10 Clients by Revenue
  const getTopClients = () => {
    const clientRevenue = {};

    baseFilteredInvoices.forEach(inv => {
      if (!clientRevenue[inv.client]) {
        clientRevenue[inv.client] = 0;
      }
      clientRevenue[inv.client] += convertToUSD(inv.amountDue, inv.currency);
    });

    const sorted = Object.entries(clientRevenue)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([client, revenue]) => ({
        client: client.length > 30 ? client.substring(0, 30) + '...' : client,
        fullClient: client,
        revenue: Math.round(revenue)
      }));

    return sorted;
  };

  // 4. Payment Velocity by Client (Average days to pay)
  const getPaymentVelocity = () => {
    const clientPayments = {};

    baseFilteredInvoices
      .filter(inv => inv.status === 'Paid' && inv.paymentDate && inv.invoiceDate)
      .forEach(inv => {
        const daysToPay = Math.floor((new Date(inv.paymentDate) - new Date(inv.invoiceDate)) / (1000 * 60 * 60 * 24));

        if (!clientPayments[inv.client]) {
          clientPayments[inv.client] = { total: 0, count: 0 };
        }
        clientPayments[inv.client].total += daysToPay;
        clientPayments[inv.client].count += 1;
      });

    const sorted = Object.entries(clientPayments)
      .map(([client, data]) => ({
        client: client.length > 30 ? client.substring(0, 30) + '...' : client,
        fullClient: client,
        avgDays: Math.round(data.total / data.count),
        color: data.total / data.count <= 30 ? '#10b981' :
               data.total / data.count <= 60 ? '#f59e0b' : '#ef4444'
      }))
      .sort((a, b) => b.avgDays - a.avgDays)
      .slice(0, 10);

    return sorted;
  };

  // 5. Revenue by Type Over Time (last 6 months)
  const getRevenueByType = () => {
    const months = [];
    const today = new Date();
    const productionStartDate = productionMode ? '2025-11-01' : null;

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = monthDate.toISOString().substring(0, 7);

      // Skip months before production start date when in production mode
      if (productionStartDate && monthStr < productionStartDate.substring(0, 7)) {
        continue;
      }

      const monthInvoices = baseFilteredInvoices.filter(inv => inv.invoiceDate.startsWith(monthStr));

      const typeRevenue = {
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      };

      monthInvoices.forEach(inv => {
        const type = inv.invoiceType || 'Other';
        if (!typeRevenue[type]) {
          typeRevenue[type] = 0;
        }
        typeRevenue[type] += convertToUSD(inv.amountDue, inv.currency);
      });

      // Round all values
      Object.keys(typeRevenue).forEach(key => {
        if (key !== 'month') {
          typeRevenue[key] = Math.round(typeRevenue[key]);
        }
      });

      months.push(typeRevenue);
    }

    return months;
  };

  // Get unique invoice types for the legend
  const getInvoiceTypes = () => {
    const types = new Set();
    baseFilteredInvoices.forEach(inv => {
      if (inv.invoiceType) types.add(inv.invoiceType);
    });
    return Array.from(types);
  };

  // PHASE 2 ANALYTICS

  // 6. Cash Flow Projection (30/60/90 days)
  // NOTE: Cashflow uses ALL invoices (not filtered by production mode) because it's forward-looking
  // and shows expected cash inflows based on due dates, regardless of when invoices were created
  const getCashFlowProjection = () => {
    const today = new Date();
    const days30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const days60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const days90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const pendingInvoices = invoices.filter(inv => inv.status === 'Pending' && inv.dueDate);

    let next30 = 0, next31to60 = 0, next61to90 = 0, beyond90 = 0;

    pendingInvoices.forEach(inv => {
      const amount = convertToUSD(inv.amountDue, inv.currency);
      if (inv.dueDate <= days30) {
        next30 += amount;
      } else if (inv.dueDate <= days60) {
        next31to60 += amount;
      } else if (inv.dueDate <= days90) {
        next61to90 += amount;
      } else {
        beyond90 += amount;
      }
    });

    return [
      { period: 'Next 30 Days', amount: Math.round(next30), color: '#10b981' },
      { period: '31-60 Days', amount: Math.round(next31to60), color: '#3b82f6' },
      { period: '61-90 Days', amount: Math.round(next61to90), color: '#f59e0b' },
      { period: 'Beyond 90 Days', amount: Math.round(beyond90), color: '#6b7280' }
    ];
  };

  // 7. Client Payment Scorecard (grade each client)
  const getClientScorecard = () => {
    const clientStats = {};

    // Analyze each client's payment history
    baseFilteredInvoices.forEach(inv => {
      if (!clientStats[inv.client]) {
        clientStats[inv.client] = {
          totalInvoices: 0,
          paidOnTime: 0,
          totalPaid: 0,
          avgDaysToPay: 0,
          totalDaysToPay: 0,
          totalRevenue: 0,
          currentOverdue: 0
        };
      }

      const stats = clientStats[inv.client];
      stats.totalInvoices++;
      stats.totalRevenue += convertToUSD(inv.amountDue, inv.currency);

      if (inv.status === 'Paid' && inv.paymentDate && inv.dueDate) {
        stats.totalPaid++;
        const daysToPay = Math.floor((new Date(inv.paymentDate) - new Date(inv.invoiceDate)) / (1000 * 60 * 60 * 24));
        const daysFromDue = Math.floor((new Date(inv.paymentDate) - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24));
        stats.totalDaysToPay += daysToPay;

        if (daysFromDue <= 0) {
          stats.paidOnTime++;
        }
      } else if (inv.status === 'Pending' && inv.dueDate) {
        const today = new Date().toISOString().split('T')[0];
        if (inv.dueDate < today) {
          stats.currentOverdue += convertToUSD(inv.amountDue, inv.currency);
        }
      }
    });

    // Calculate grades
    const scoredClients = Object.entries(clientStats)
      .filter(([, stats]) => stats.totalPaid > 0) // Only clients with payment history
      .map(([client, stats]) => {
        stats.avgDaysToPay = stats.totalDaysToPay / stats.totalPaid;
        const onTimeRate = (stats.paidOnTime / stats.totalPaid) * 100;

        // Grade based on on-time payment rate and avg days to pay
        let grade = 'D';
        let gradeColor = '#ef4444';

        if (onTimeRate >= 90 && stats.avgDaysToPay <= 30) {
          grade = 'A';
          gradeColor = '#10b981';
        } else if (onTimeRate >= 75 && stats.avgDaysToPay <= 45) {
          grade = 'B';
          gradeColor = '#3b82f6';
        } else if (onTimeRate >= 60 && stats.avgDaysToPay <= 60) {
          grade = 'C';
          gradeColor = '#f59e0b';
        }

        return {
          client: client.length > 30 ? client.substring(0, 30) + '...' : client,
          fullClient: client,
          grade,
          gradeColor,
          onTimeRate: Math.round(onTimeRate),
          avgDaysToPay: Math.round(stats.avgDaysToPay),
          totalRevenue: Math.round(stats.totalRevenue),
          currentOverdue: Math.round(stats.currentOverdue)
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    return scoredClients;
  };

  // 8. Collection Efficiency Metrics
  const getCollectionEfficiency = () => {
    const paidInvoices = baseFilteredInvoices.filter(inv => inv.status === 'Paid' && inv.paymentDate && inv.dueDate);

    let paidOnTime = 0, paidWithin30 = 0, paidWithin60 = 0, paidWithin90 = 0, paidBeyond90 = 0;

    paidInvoices.forEach(inv => {
      const daysFromDue = Math.floor((new Date(inv.paymentDate) - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24));

      if (daysFromDue <= 0) {
        paidOnTime++;
      } else if (daysFromDue <= 30) {
        paidWithin30++;
      } else if (daysFromDue <= 60) {
        paidWithin60++;
      } else if (daysFromDue <= 90) {
        paidWithin90++;
      } else {
        paidBeyond90++;
      }
    });

    const total = paidInvoices.length || 1;

    return [
      { category: 'On Time', count: paidOnTime, percentage: Math.round((paidOnTime / total) * 100), color: '#10b981' },
      { category: 'Within 30 Days', count: paidWithin30, percentage: Math.round((paidWithin30 / total) * 100), color: '#3b82f6' },
      { category: 'Within 60 Days', count: paidWithin60, percentage: Math.round((paidWithin60 / total) * 100), color: '#f59e0b' },
      { category: 'Within 90 Days', count: paidWithin90, percentage: Math.round((paidWithin90 / total) * 100), color: '#f97316' },
      { category: 'Beyond 90 Days', count: paidBeyond90, percentage: Math.round((paidBeyond90 / total) * 100), color: '#ef4444' }
    ];
  };

  // 9. Contract Value vs Actual Invoiced
  const getContractUtilization = async () => {
    try {
      const response = await axios.get(`${API_URL}/contracts`);
      const contracts = response.data;

      const contractStats = contracts.map(contract => {
        const contractInvoices = baseFilteredInvoices.filter(inv =>
          inv.customerContract && inv.customerContract.toLowerCase() === contract.contractName.toLowerCase()
        );

        const totalInvoiced = contractInvoices.reduce((sum, inv) =>
          sum + convertToUSD(inv.amountDue, inv.currency), 0
        );

        const contractValueUSD = contract.contractValue * (exchangeRates[contract.currency] || 1);
        // Cap utilization at 100% (exchange rate fluctuations can cause values over 100%)
        const utilization = Math.min((totalInvoiced / contractValueUSD) * 100, 100);

        return {
          contract: contract.contractName.length > 25 ? contract.contractName.substring(0, 25) + '...' : contract.contractName,
          fullContract: contract.contractName,
          contractValue: Math.round(contractValueUSD),
          invoiced: Math.round(totalInvoiced),
          utilization: Math.round(utilization),
          remaining: Math.round(contractValueUSD - totalInvoiced)
        };
      })
      .filter(c => c.contractValue > 0)
      .sort((a, b) => b.contractValue - a.contractValue)
      .slice(0, 10);

      return contractStats;
    } catch (error) {
      console.error('Error loading contracts:', error);
      return [];
    }
  };

  // 10. Risk Dashboard
  const getRiskMetrics = () => {
    const today = new Date().toISOString().split('T')[0];
    const pendingInvoices = baseFilteredInvoices.filter(inv => inv.status === 'Pending');

    // High overdue balances (>$50k overdue)
    const clientOverdue = {};
    pendingInvoices.forEach(inv => {
      if (inv.dueDate && inv.dueDate < today) {
        if (!clientOverdue[inv.client]) {
          clientOverdue[inv.client] = 0;
        }
        clientOverdue[inv.client] += convertToUSD(inv.amountDue, inv.currency);
      }
    });

    const highRiskClients = Object.entries(clientOverdue)
      .filter(([, amount]) => amount > 50000)
      .map(([client, amount]) => ({
        client: client.length > 30 ? client.substring(0, 30) + '...' : client,
        fullClient: client,
        overdueAmount: Math.round(amount),
        riskLevel: amount > 200000 ? 'Critical' : amount > 100000 ? 'High' : 'Medium',
        riskColor: amount > 200000 ? '#dc2626' : amount > 100000 ? '#f59e0b' : '#fbbf24'
      }))
      .sort((a, b) => b.overdueAmount - a.overdueAmount)
      .slice(0, 10);

    // Calculate overall risk metrics
    const totalOverdue = Object.values(clientOverdue).reduce((sum, val) => sum + val, 0);
    const avgOverdueAge = pendingInvoices
      .filter(inv => inv.dueDate && inv.dueDate < today)
      .reduce((sum, inv) => {
        const daysOverdue = Math.floor((new Date() - new Date(inv.dueDate)) / (1000 * 60 * 60 * 24));
        return sum + daysOverdue;
      }, 0) / (pendingInvoices.filter(inv => inv.dueDate && inv.dueDate < today).length || 1);

    return {
      highRiskClients,
      totalOverdue: Math.round(totalOverdue),
      avgOverdueAge: Math.round(avgOverdueAge),
      clientsAtRisk: highRiskClients.length
    };
  };

  // PHASE 3 ANALYTICS

  // 11. Payment Probability Predictions (ML-based heuristics)
  const getPaymentProbability = () => {
    const today = new Date().toISOString().split('T')[0];
    const pendingInvoices = baseFilteredInvoices.filter(inv => inv.status === 'Pending' && inv.dueDate);

    const predictions = pendingInvoices.map(inv => {
      // Calculate client's historical payment behavior
      const clientInvoices = baseFilteredInvoices.filter(i => i.client === inv.client && i.status === 'Paid' && i.paymentDate && i.dueDate);

      if (clientInvoices.length === 0) {
        // New client - medium probability
        return {
          invoiceNumber: inv.invoiceNumber,
          client: inv.client.length > 25 ? inv.client.substring(0, 25) + '...' : inv.client,
          amount: convertToUSD(inv.amountDue, inv.currency),
          dueDate: inv.dueDate,
          probability: 60,
          probabilityLabel: 'Medium',
          color: '#f59e0b',
          factors: 'New client - insufficient history'
        };
      }

      // Calculate historical metrics
      const onTimePaid = clientInvoices.filter(i => i.paymentDate <= i.dueDate).length;
      const onTimeRate = (onTimePaid / clientInvoices.length) * 100;

      const avgDaysLate = clientInvoices.reduce((sum, i) => {
        const daysLate = Math.floor((new Date(i.paymentDate) - new Date(i.dueDate)) / (1000 * 60 * 60 * 24));
        return sum + Math.max(0, daysLate);
      }, 0) / clientInvoices.length;

      // Days until due
      const daysUntilDue = Math.floor((new Date(inv.dueDate) - new Date(today)) / (1000 * 60 * 60 * 24));

      // Calculate probability score (0-100)
      let probability = 50; // Base probability

      // Adjust based on historical on-time rate (±30 points)
      probability += (onTimeRate / 100) * 30;

      // Adjust based on average lateness (±20 points)
      if (avgDaysLate <= 5) probability += 20;
      else if (avgDaysLate <= 15) probability += 10;
      else if (avgDaysLate <= 30) probability -= 10;
      else probability -= 20;

      // Adjust based on time until due (±10 points)
      if (daysUntilDue > 30) probability += 10;
      else if (daysUntilDue > 15) probability += 5;
      else if (daysUntilDue < 0) probability -= 15; // Already overdue

      // Cap between 5 and 95
      probability = Math.max(5, Math.min(95, probability));

      // Categorize
      let probabilityLabel, color;
      if (probability >= 75) {
        probabilityLabel = 'High';
        color = '#10b981';
      } else if (probability >= 50) {
        probabilityLabel = 'Medium';
        color = '#f59e0b';
      } else {
        probabilityLabel = 'Low';
        color = '#ef4444';
      }

      return {
        invoiceNumber: inv.invoiceNumber,
        client: inv.client.length > 25 ? inv.client.substring(0, 25) + '...' : inv.client,
        amount: Math.round(convertToUSD(inv.amountDue, inv.currency)),
        dueDate: inv.dueDate,
        probability: Math.round(probability),
        probabilityLabel,
        color,
        factors: `${Math.round(onTimeRate)}% on-time history, ${daysUntilDue} days until due`
      };
    });

    // Sort by probability (lowest first - highest risk)
    return predictions.sort((a, b) => a.probability - b.probability).slice(0, 10);
  };

  // 12. Revenue Forecasting (next 6 months based on trends)
  const getRevenueForecast = () => {
    // Calculate historical monthly revenue for last 12 months
    const monthlyRevenue = [];
    const today = new Date();
    const productionStartDate = productionMode ? '2025-11-01' : null;

    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = monthDate.toISOString().substring(0, 7);

      // Skip months before production start date when in production mode
      if (productionStartDate && monthStr < productionStartDate.substring(0, 7)) {
        continue;
      }

      const monthInvoices = baseFilteredInvoices.filter(inv => inv.invoiceDate && inv.invoiceDate.startsWith(monthStr));
      const revenue = monthInvoices.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

      monthlyRevenue.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: Math.round(revenue),
        type: 'Actual'
      });
    }

    // Simple linear regression for trend
    const n = monthlyRevenue.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);
    const sumXY = monthlyRevenue.reduce((sum, m, i) => sum + (i * m.revenue), 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate average for baseline
    const avgRevenue = sumY / n;

    // Project next 6 months with trend + seasonal adjustment
    const forecast = [];
    for (let i = 1; i <= 6; i++) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const forecastValue = intercept + slope * (n + i - 1);

      // Add some variance (±10%) for realism
      const variance = forecastValue * 0.05;

      forecast.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        revenue: Math.max(0, Math.round(forecastValue)),
        type: 'Forecast',
        upper: Math.round(forecastValue + variance),
        lower: Math.round(forecastValue - variance)
      });
    }

    // Return last 6 actual + 6 forecast
    return [...monthlyRevenue.slice(-6), ...forecast];
  };

  // 13. Seasonal Trend Analysis
  const getSeasonalTrends = () => {
    // Aggregate revenue by month across all years
    const monthlyAggregates = Array(12).fill(0).map(() => ({ total: 0, count: 0 }));

    baseFilteredInvoices.forEach(inv => {
      if (inv.invoiceDate) {
        const month = new Date(inv.invoiceDate).getMonth();
        monthlyAggregates[month].total += convertToUSD(inv.amountDue, inv.currency);
        monthlyAggregates[month].count += 1;
      }
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return monthNames.map((month, index) => ({
      month,
      avgRevenue: monthlyAggregates[index].count > 0
        ? Math.round(monthlyAggregates[index].total / monthlyAggregates[index].count)
        : 0,
      totalRevenue: Math.round(monthlyAggregates[index].total),
      invoiceCount: monthlyAggregates[index].count
    }));
  };

  // 14. Currency Exposure Analysis
  const getCurrencyExposure = () => {
    const pendingInvoices = baseFilteredInvoices.filter(inv => inv.status === 'Pending');
    const currencyTotals = {};

    pendingInvoices.forEach(inv => {
      if (!currencyTotals[inv.currency]) {
        currencyTotals[inv.currency] = { amount: 0, amountUSD: 0, count: 0 };
      }
      currencyTotals[inv.currency].amount += inv.amountDue;
      currencyTotals[inv.currency].amountUSD += convertToUSD(inv.amountDue, inv.currency);
      currencyTotals[inv.currency].count += 1;
    });

    const total = Object.values(currencyTotals).reduce((sum, c) => sum + c.amountUSD, 0);

    return Object.entries(currencyTotals)
      .map(([currency, data]) => ({
        currency,
        amount: Math.round(data.amount),
        amountUSD: Math.round(data.amountUSD),
        percentage: total > 0 ? Math.round((data.amountUSD / total) * 100) : 0,
        invoiceCount: data.count,
        color: currency === 'USD' ? '#10b981' :
               currency === 'AUD' ? '#3b82f6' :
               currency === 'EUR' ? '#f59e0b' :
               currency === 'GBP' ? '#8b5cf6' :
               currency === 'SGD' ? '#ec4899' : '#6b7280'
      }))
      .sort((a, b) => b.amountUSD - a.amountUSD);
  };

  // 15. Expected vs Actual Invoice Tracking
  const getExpectedVsActual = async () => {
    try {
      const response = await axios.get(`${API_URL}/expected-invoices`);
      let expectedInvoices = response.data;

      // Filter expected invoices in production mode - only show those based on invoices from Nov 2025 onwards
      const productionStartDate = productionMode ? '2025-11-01' : null;
      if (productionStartDate) {
        expectedInvoices = expectedInvoices.filter(exp =>
          exp.lastInvoiceDate && exp.lastInvoiceDate >= productionStartDate
        );
      }

      // Group by month
      const monthlyComparison = {};
      const today = new Date();

      // Last 6 months
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthStr = monthDate.toISOString().substring(0, 7);
        const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        // Skip months before production start date when in production mode
        if (productionStartDate && monthStr < productionStartDate.substring(0, 7)) {
          continue;
        }

        // Expected invoices for this month
        const expected = expectedInvoices
          .filter(exp => exp.expectedDate && exp.expectedDate.startsWith(monthStr) && !exp.acknowledged)
          .reduce((sum, exp) => sum + convertToUSD(exp.expectedAmount || 0, exp.currency || 'USD'), 0);

        // Actual invoices for this month
        const actual = baseFilteredInvoices
          .filter(inv => inv.invoiceDate && inv.invoiceDate.startsWith(monthStr))
          .reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

        monthlyComparison[monthLabel] = {
          month: monthLabel,
          expected: Math.round(expected),
          actual: Math.round(actual),
          variance: Math.round(actual - expected),
          variancePercent: expected > 0 ? Math.round(((actual - expected) / expected) * 100) : 0
        };
      }

      return Object.values(monthlyComparison);
    } catch (error) {
      console.error('Error loading expected invoices:', error);
      return [];
    }
  };

  // 16. Invoice Volume Trends (last 12 months)
  const getInvoiceVolumeTrends = () => {
    const volumeData = [];
    const today = new Date();
    const productionStartDate = productionMode ? '2025-11-01' : null;

    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = monthDate.toISOString().substring(0, 7);

      // Skip months before production start date when in production mode
      if (productionStartDate && monthStr < productionStartDate.substring(0, 7)) {
        continue;
      }

      const monthInvoices = baseFilteredInvoices.filter(inv => inv.invoiceDate && inv.invoiceDate.startsWith(monthStr));

      volumeData.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        count: monthInvoices.length,
        revenue: Math.round(monthInvoices.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0))
      });
    }

    return volumeData;
  };

  // 17. Average Invoice Value Trends (last 12 months)
  const getAvgInvoiceValueTrends = () => {
    const avgData = [];
    const today = new Date();
    const productionStartDate = productionMode ? '2025-11-01' : null;

    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = monthDate.toISOString().substring(0, 7);

      // Skip months before production start date when in production mode
      if (productionStartDate && monthStr < productionStartDate.substring(0, 7)) {
        continue;
      }

      const monthInvoices = baseFilteredInvoices.filter(inv => inv.invoiceDate && inv.invoiceDate.startsWith(monthStr));

      const totalRevenue = monthInvoices.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);
      const avgValue = monthInvoices.length > 0 ? totalRevenue / monthInvoices.length : 0;

      avgData.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        avgValue: Math.round(avgValue),
        count: monthInvoices.length
      });
    }

    return avgData;
  };

  // 18. Year-over-Year Growth Analysis
  const getYoYGrowth = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const lastYear = currentYear - 1;
    const productionStartDate = productionMode ? '2025-11-01' : null;

    const monthlyComparison = [];

    // Compare each month of current year vs same month last year
    for (let month = 0; month < 12; month++) {
      const monthDate = new Date(currentYear, month, 1);
      const monthStr = monthDate.toISOString().substring(0, 7);
      const lastYearMonthStr = `${lastYear}-${String(month + 1).padStart(2, '0')}`;

      // Skip months before production start date when in production mode
      if (productionStartDate && monthStr < productionStartDate.substring(0, 7)) {
        continue;
      }

      const currentYearRevenue = baseFilteredInvoices
        .filter(inv => inv.invoiceDate && inv.invoiceDate.startsWith(monthStr))
        .reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

      const lastYearRevenue = baseFilteredInvoices
        .filter(inv => inv.invoiceDate && inv.invoiceDate.startsWith(lastYearMonthStr))
        .reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

      const growth = lastYearRevenue > 0
        ? ((currentYearRevenue - lastYearRevenue) / lastYearRevenue) * 100
        : 0;

      monthlyComparison.push({
        month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
        currentYear: Math.round(currentYearRevenue),
        lastYear: Math.round(lastYearRevenue),
        growth: Math.round(growth)
      });
    }

    return monthlyComparison;
  };

  // 19. Revenue Concentration Risk
  const getRevenueConcentration = () => {
    const clientRevenue = {};

    baseFilteredInvoices.forEach(inv => {
      if (!clientRevenue[inv.client]) {
        clientRevenue[inv.client] = 0;
      }
      clientRevenue[inv.client] += convertToUSD(inv.amountDue, inv.currency);
    });

    const sorted = Object.entries(clientRevenue)
      .sort(([, a], [, b]) => b - a)
      .map(([client, revenue]) => ({ client, revenue }));

    const totalRevenue = sorted.reduce((sum, c) => sum + c.revenue, 0);

    const top1Revenue = sorted.slice(0, 1).reduce((sum, c) => sum + c.revenue, 0);
    const top3Revenue = sorted.slice(0, 3).reduce((sum, c) => sum + c.revenue, 0);
    const top5Revenue = sorted.slice(0, 5).reduce((sum, c) => sum + c.revenue, 0);
    const top10Revenue = sorted.slice(0, 10).reduce((sum, c) => sum + c.revenue, 0);

    return {
      top1Percent: totalRevenue > 0 ? Math.round((top1Revenue / totalRevenue) * 100) : 0,
      top3Percent: totalRevenue > 0 ? Math.round((top3Revenue / totalRevenue) * 100) : 0,
      top5Percent: totalRevenue > 0 ? Math.round((top5Revenue / totalRevenue) * 100) : 0,
      top10Percent: totalRevenue > 0 ? Math.round((top10Revenue / totalRevenue) * 100) : 0,
      totalClients: sorted.length,
      topClients: sorted.slice(0, 5).map(c => ({
        client: c.client.length > 30 ? c.client.substring(0, 30) + '...' : c.client,
        revenue: Math.round(c.revenue),
        percentage: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0
      }))
    };
  };

  // 20. Monthly Performance Dashboard (current month vs last month)
  const getMonthlyPerformance = () => {
    const today = new Date();
    const currentMonth = today.toISOString().substring(0, 7);
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonth = lastMonthDate.toISOString().substring(0, 7);

    const currentMonthInvoices = baseFilteredInvoices.filter(inv => inv.invoiceDate && inv.invoiceDate.startsWith(currentMonth));
    const lastMonthInvoices = baseFilteredInvoices.filter(inv => inv.invoiceDate && inv.invoiceDate.startsWith(lastMonth));

    const currentRevenue = currentMonthInvoices.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);
    const lastMonthRevenue = lastMonthInvoices.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

    const currentPaidCount = currentMonthInvoices.filter(inv => inv.status === 'Paid').length;
    const lastMonthPaidCount = lastMonthInvoices.filter(inv => inv.status === 'Paid').length;

    const revenueChange = lastMonthRevenue > 0
      ? ((currentRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    const countChange = lastMonthInvoices.length > 0
      ? ((currentMonthInvoices.length - lastMonthInvoices.length) / lastMonthInvoices.length) * 100
      : 0;

    return {
      currentMonth: {
        month: today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        revenue: Math.round(currentRevenue),
        count: currentMonthInvoices.length,
        paid: currentPaidCount,
        avgValue: currentMonthInvoices.length > 0 ? Math.round(currentRevenue / currentMonthInvoices.length) : 0
      },
      lastMonth: {
        month: lastMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        revenue: Math.round(lastMonthRevenue),
        count: lastMonthInvoices.length,
        paid: lastMonthPaidCount,
        avgValue: lastMonthInvoices.length > 0 ? Math.round(lastMonthRevenue / lastMonthInvoices.length) : 0
      },
      changes: {
        revenueChange: Math.round(revenueChange),
        countChange: Math.round(countChange)
      }
    };
  };

  const dsi = calculateDSI();
  const dsiTrend = getDSITrend();
  const agingTrend = getAgingTrend();
  const topClients = getTopClients();
  const paymentVelocity = getPaymentVelocity();
  const revenueByType = getRevenueByType();
  const invoiceTypes = getInvoiceTypes();

  // Phase 2 metrics
  const cashFlowProjection = getCashFlowProjection();
  const clientScorecard = getClientScorecard();
  const collectionEfficiency = getCollectionEfficiency();
  const riskMetrics = getRiskMetrics();
  const [contractUtilization, setContractUtilization] = useState([]);

  // Phase 3 metrics
  const paymentProbability = getPaymentProbability();
  const revenueForecast = getRevenueForecast();
  const seasonalTrends = getSeasonalTrends();
  const currencyExposure = getCurrencyExposure();
  const [expectedVsActual, setExpectedVsActual] = useState([]);

  // Additional analytics
  const invoiceVolumeTrends = getInvoiceVolumeTrends();
  const avgInvoiceValueTrends = getAvgInvoiceValueTrends();
  const yoyGrowth = getYoYGrowth();
  const revenueConcentration = getRevenueConcentration();
  const monthlyPerformance = getMonthlyPerformance();

  // Load async data
  useEffect(() => {
    getContractUtilization().then(setContractUtilization);
    getExpectedVsActual().then(setExpectedVsActual);
  }, [invoices, exchangeRates]);

  // Color palette consistent with the app
  const typeColors = {
    'PS': '#707CF1',
    'Maint': '#151744',
    'Sub': '#10b981',
    'Hosting': '#f59e0b',
    'MS': '#ec4899',
    'SW': '#10B981',  // Green color for software
    'HW': '#8b5cf6',
    '3PP': '#06b6d4',
    'Credit Memo': '#ef4444',
    'Other': '#6b7280'
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-[#707CF1] mb-2">Loading Analytics...</div>
          <div className="text-gray-600">Please wait while we fetch your invoice data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Key metrics and insights for your invoice data</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow border-2 border-purple-200">
            <span className="text-sm font-medium text-gray-700">
              {productionMode ? '📊 Production Mode (From 1 Nov 2025)' : '🧪 Testing Mode (All Data)'}
            </span>
            {/* Hide production mode toggle after Nov 1, 2025 */}
            {new Date() < new Date('2025-11-01') && (
              <button
                onClick={() => setProductionMode(!productionMode)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  productionMode
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {productionMode ? 'Switch to Testing' : 'Switch to Production'}
              </button>
            )}
          </div>
          <button
            onClick={onNavigateBack}
            className="px-6 py-3 bg-[#707CF1] text-white rounded-lg hover:bg-[#5a66d1] transition shadow"
          >
            ← Back to Invoice Tracker
          </button>
        </div>
      </div>

      {/* Date Filter */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="year">Current Year</option>
              <option value="allTime">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="border rounded px-3 py-2"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-[#707CF1]">
          <div className="text-gray-600 text-sm font-medium">Days Invoices Outstanding (DSI)</div>
          <div className="text-3xl font-bold text-[#707CF1] my-2">
            {baseFilteredInvoices.length === 0 ? 'N/A' : `${dsi} days`}
          </div>
          <div className="text-xs text-gray-500">
            {baseFilteredInvoices.length === 0
              ? 'No invoice data in selected period'
              : 'Days of revenue tied up in outstanding invoices'}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <div className="text-gray-600 text-sm font-medium">Total Revenue (Filtered)</div>
          <div className="text-3xl font-bold text-green-500 my-2">
            ${Math.round(filteredInvoices.reduce((sum, inv) =>
              sum + convertToUSD(inv.amountDue, inv.currency), 0)).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">{filteredInvoices.length} invoices</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-500">
          <div className="text-gray-600 text-sm font-medium">Outstanding</div>
          <div className="text-3xl font-bold text-orange-500 my-2">
            ${Math.round(filteredInvoices
              .filter(inv => inv.status === 'Pending')
              .reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0)
            ).toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            {filteredInvoices.filter(inv => inv.status === 'Pending').length} unpaid invoices
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* DSI Trend */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Days Invoices Outstanding Trend (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dsiTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="dsi" stroke="#707CF1" strokeWidth={2} name="DSI (days)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top 10 Clients */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Top 10 Clients by Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topClients} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatAxisNumber} />
              <YAxis dataKey="client" type="category" width={180} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="#707CF1" name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Aging Trend */}
        <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Aging Trend (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={agingTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatAxisNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="Current" stackId="a" fill="#10b981" />
              <Bar dataKey="31-60" stackId="a" fill="#f59e0b" />
              <Bar dataKey="61-90" stackId="a" fill="#f97316" />
              <Bar dataKey="91-120" stackId="a" fill="#ef4444" />
              <Bar dataKey="120+" stackId="a" fill="#991b1b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Velocity */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Payment Velocity by Client (Top 10)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={paymentVelocity} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="client" type="category" width={180} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="avgDays" name="Avg Days to Pay">
                {paymentVelocity.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 flex gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>≤30 days (Good)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span>31-60 days (Average)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>&gt;60 days (Slow)</span>
            </div>
          </div>
        </div>

        {/* Revenue by Type */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Revenue by Type (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatAxisNumber} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {invoiceTypes.map(type => (
                <Bar
                  key={type}
                  dataKey={type}
                  stackId="a"
                  fill={typeColors[type] || '#6b7280'}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* PHASE 2 ANALYTICS */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Advanced Analytics</h2>

        {/* Phase 2 Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
            <div className="text-gray-600 text-sm font-medium">Expected (Next 30 Days)</div>
            <div className="text-3xl font-bold text-blue-500 my-2">
              ${cashFlowProjection[0].amount.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Invoices due in next 30 days</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
            <div className="text-gray-600 text-sm font-medium">Total Overdue</div>
            <div className="text-3xl font-bold text-red-500 my-2">
              ${riskMetrics.totalOverdue.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">{riskMetrics.clientsAtRisk} clients at risk</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
            <div className="text-gray-600 text-sm font-medium">Avg Overdue Age</div>
            <div className="text-3xl font-bold text-yellow-500 my-2">
              {riskMetrics.avgOverdueAge} days
            </div>
            <div className="text-xs text-gray-500">Average age of overdue invoices</div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
            <div className="text-gray-600 text-sm font-medium">On-Time Payment Rate</div>
            <div className="text-3xl font-bold text-green-500 my-2">
              {collectionEfficiency[0].percentage}%
            </div>
            <div className="text-xs text-gray-500">Invoices paid by due date</div>
          </div>
        </div>

        {/* Phase 2 Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Cash Flow Projection */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Cash Flow Projection</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cashFlowProjection}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={formatAxisNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" name="Expected Cash Inflow">
                  {cashFlowProjection.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 text-xs text-gray-600">
              Projected cash inflows based on invoice due dates
            </div>
          </div>

          {/* Collection Efficiency */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Collection Efficiency</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={collectionEfficiency}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percentage }) => `${category}: ${percentage}%`}
                  outerRadius={100}
                  dataKey="percentage"
                >
                  {collectionEfficiency.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 text-xs text-gray-600">
              Payment timing distribution for paid invoices
            </div>
          </div>

          {/* Client Payment Scorecard */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Client Payment Scorecard (Top 10)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-2">Client</th>
                    <th className="text-center py-2 px-2">Grade</th>
                    <th className="text-right py-2 px-2">On-Time %</th>
                    <th className="text-right py-2 px-2">Avg Days</th>
                  </tr>
                </thead>
                <tbody>
                  {clientScorecard.map((client, index) => (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="py-2 px-2 text-xs">{client.client}</td>
                      <td className="text-center py-2 px-2">
                        <span
                          className="inline-block w-8 h-8 rounded-full text-white font-bold flex items-center justify-center"
                          style={{ backgroundColor: client.gradeColor }}
                        >
                          {client.grade}
                        </span>
                      </td>
                      <td className="text-right py-2 px-2">{client.onTimeRate}%</td>
                      <td className="text-right py-2 px-2">{client.avgDaysToPay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <span>A (Excellent)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <span>B (Good)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                <span>C (Fair)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span>D (Poor)</span>
              </div>
            </div>
          </div>

          {/* Risk Dashboard */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">High Risk Clients</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-2">Client</th>
                    <th className="text-center py-2 px-2">Risk</th>
                    <th className="text-right py-2 px-2">Overdue Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {riskMetrics.highRiskClients.length > 0 ? (
                    riskMetrics.highRiskClients.map((client, index) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="py-2 px-2 text-xs">{client.client}</td>
                        <td className="text-center py-2 px-2">
                          <span
                            className="inline-block px-2 py-1 rounded text-xs font-semibold text-white"
                            style={{ backgroundColor: client.riskColor }}
                          >
                            {client.riskLevel}
                          </span>
                        </td>
                        <td className="text-right py-2 px-2">{formatNumber(client.overdueAmount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="text-center py-4 text-gray-500">
                        No high-risk clients (overdue &gt; $50k)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-600 rounded"></div>
                <span>Critical (&gt;$200k)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span>High ($100-200k)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                <span>Medium ($50-100k)</span>
              </div>
            </div>
          </div>

          {/* Contract Utilization */}
          <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Contract Value vs Actual Invoiced (Top 10)</h3>
            {contractUtilization.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={contractUtilization}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="contract" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={formatAxisNumber} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="contractValue" fill="#707CF1" name="Contract Value" />
                  <Bar dataKey="invoiced" fill="#10b981" name="Invoiced" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                Loading contract data...
              </div>
            )}
            <div className="mt-4 text-xs text-gray-600">
              Compare total contract values with actual invoiced amounts to identify utilization rates
            </div>
          </div>

        </div>
      </div>

      {/* PHASE 3 ANALYTICS */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Predictive Analytics & Insights</h2>

        {/* Phase 3 Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Payment Probability Predictions */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Payment Probability (Top 10 Risk Invoices)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-2">Invoice</th>
                    <th className="text-left py-2 px-2">Client</th>
                    <th className="text-right py-2 px-2">Amount</th>
                    <th className="text-center py-2 px-2">Probability</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentProbability.length > 0 ? (
                    paymentProbability.map((pred, index) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="py-2 px-2 text-xs">{pred.invoiceNumber}</td>
                        <td className="py-2 px-2 text-xs">{pred.client}</td>
                        <td className="text-right py-2 px-2">{formatNumber(pred.amount)}</td>
                        <td className="text-center py-2 px-2">
                          <div className="flex flex-col items-center">
                            <span
                              className="inline-block px-2 py-1 rounded text-xs font-semibold text-white mb-1"
                              style={{ backgroundColor: pred.color }}
                            >
                              {pred.probability}% {pred.probabilityLabel}
                            </span>
                            <span className="text-xs text-gray-500">{pred.factors}</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="text-center py-4 text-gray-500">
                        No pending invoices to analyze
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span>High (≥75%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span>Medium (50-74%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Low (&lt;50%)</span>
              </div>
            </div>
          </div>

          {/* Revenue Forecasting */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Revenue Forecast (6 Month Projection)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueForecast}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={formatAxisNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#707CF1" strokeWidth={2} name="Revenue" dot={{ r: 4 }}>
                  {revenueForecast.map((entry, index) => (
                    <Cell key={`cell-${index}`} stroke={entry.type === 'Actual' ? '#707CF1' : '#f59e0b'} />
                  ))}
                </Line>
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-[#707CF1] rounded"></div>
                <span>Actual (Last 6 Months)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span>Forecast (Next 6 Months)</span>
              </div>
            </div>
          </div>

          {/* Seasonal Trends */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Seasonal Trends (All Years Combined)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={seasonalTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={formatAxisNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="avgRevenue" fill="#707CF1" name="Avg Monthly Revenue" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 text-xs text-gray-600">
              Historical monthly patterns to identify seasonal revenue fluctuations
            </div>
          </div>

          {/* Currency Exposure */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Currency Exposure (Outstanding)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={currencyExposure}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ currency, percentage }) => `${currency}: ${percentage}%`}
                  outerRadius={100}
                  dataKey="percentage"
                >
                  {currencyExposure.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1">Currency</th>
                    <th className="text-right py-1">Amount</th>
                    <th className="text-right py-1">USD Equiv</th>
                    <th className="text-right py-1">%</th>
                  </tr>
                </thead>
                <tbody>
                  {currencyExposure.map((curr, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-1">{curr.currency}</td>
                      <td className="text-right py-1">{formatNumber(curr.amount)}</td>
                      <td className="text-right py-1">{formatNumber(curr.amountUSD)}</td>
                      <td className="text-right py-1">{curr.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expected vs Actual Tracking */}
          {/* Show chart - will only display months from Nov onwards in production mode */}
          {expectedVsActual.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Expected vs Actual Invoices (Last 6 Months)</h3>
              {expectedVsActual.length > 0 ? (
                <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={expectedVsActual}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={formatAxisNumber} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="expected" fill="#f59e0b" name="Expected" />
                    <Bar dataKey="actual" fill="#10b981" name="Actual" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-2 px-2">Month</th>
                        <th className="text-right py-2 px-2">Expected</th>
                        <th className="text-right py-2 px-2">Actual</th>
                        <th className="text-right py-2 px-2">Variance</th>
                        <th className="text-right py-2 px-2">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expectedVsActual.map((row, index) => (
                        <tr key={index} className="border-b border-gray-200">
                          <td className="py-2 px-2">{row.month}</td>
                          <td className="text-right py-2 px-2">{formatNumber(row.expected)}</td>
                          <td className="text-right py-2 px-2">{formatNumber(row.actual)}</td>
                          <td className="text-right py-2 px-2">
                            <span className={row.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {row.variance >= 0 ? '+' : ''}{formatNumber(row.variance)}
                            </span>
                          </td>
                          <td className="text-right py-2 px-2">
                            <span className={row.variancePercent >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {row.variancePercent >= 0 ? '+' : ''}{row.variancePercent}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                Loading expected invoice data...
              </div>
            )}
              <div className="mt-4 text-xs text-gray-600">
                Track how actual invoices compare to expected invoices to identify missing or delayed invoices
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ADDITIONAL ANALYTICS */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Additional Insights</h2>

        {/* Monthly Performance Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{monthlyPerformance.currentMonth.month}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-600 text-sm">Revenue</div>
                <div className="text-2xl font-bold text-[#707CF1]">{formatNumber(monthlyPerformance.currentMonth.revenue)}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Invoices</div>
                <div className="text-2xl font-bold text-gray-800">{monthlyPerformance.currentMonth.count}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Paid</div>
                <div className="text-2xl font-bold text-green-500">{monthlyPerformance.currentMonth.paid}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Avg Value</div>
                <div className="text-2xl font-bold text-gray-800">{formatNumber(monthlyPerformance.currentMonth.avgValue)}</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{monthlyPerformance.lastMonth.month} (Comparison)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-600 text-sm">Revenue</div>
                <div className="text-2xl font-bold text-gray-600">{formatNumber(monthlyPerformance.lastMonth.revenue)}</div>
                <div className={`text-sm font-semibold ${monthlyPerformance.changes.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {monthlyPerformance.changes.revenueChange >= 0 ? '↑' : '↓'} {Math.abs(monthlyPerformance.changes.revenueChange)}%
                </div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Invoices</div>
                <div className="text-2xl font-bold text-gray-600">{monthlyPerformance.lastMonth.count}</div>
                <div className={`text-sm font-semibold ${monthlyPerformance.changes.countChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {monthlyPerformance.changes.countChange >= 0 ? '↑' : '↓'} {Math.abs(monthlyPerformance.changes.countChange)}%
                </div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Paid</div>
                <div className="text-2xl font-bold text-gray-600">{monthlyPerformance.lastMonth.paid}</div>
              </div>
              <div>
                <div className="text-gray-600 text-sm">Avg Value</div>
                <div className="text-2xl font-bold text-gray-600">{formatNumber(monthlyPerformance.lastMonth.avgValue)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Invoice Volume Trends */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Invoice Volume Trends (Last 12 Months)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={invoiceVolumeTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" tickFormatter={formatAxisNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="count" stroke="#707CF1" strokeWidth={2} name="Invoice Count" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 text-xs text-gray-600">
              Track invoice volume and revenue trends over time
            </div>
          </div>

          {/* Average Invoice Value Trends */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Average Invoice Value (Last 12 Months)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={avgInvoiceValueTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={formatAxisNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="avgValue" stroke="#f59e0b" strokeWidth={2} name="Avg Invoice Value" />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 text-xs text-gray-600">
              Monitor changes in average invoice values over time
            </div>
          </div>

          {/* Year-over-Year Growth */}
          <div className="bg-white p-6 rounded-lg shadow lg:col-span-2">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Year-over-Year Growth Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={yoyGrowth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={formatAxisNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="currentYear" fill="#707CF1" name={`${new Date().getFullYear()}`} />
                <Bar dataKey="lastYear" fill="#6b7280" name={`${new Date().getFullYear() - 1}`} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-2">Month</th>
                    <th className="text-right py-2 px-2">{new Date().getFullYear()}</th>
                    <th className="text-right py-2 px-2">{new Date().getFullYear() - 1}</th>
                    <th className="text-right py-2 px-2">Growth %</th>
                  </tr>
                </thead>
                <tbody>
                  {yoyGrowth.map((row, index) => (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="py-2 px-2">{row.month}</td>
                      <td className="text-right py-2 px-2">{formatNumber(row.currentYear)}</td>
                      <td className="text-right py-2 px-2">{formatNumber(row.lastYear)}</td>
                      <td className="text-right py-2 px-2">
                        <span className={row.growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {row.growth >= 0 ? '+' : ''}{row.growth}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue Concentration Risk */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Revenue Concentration Risk</h3>
            <div className="mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded">
                  <div className="text-3xl font-bold text-[#707CF1]">{revenueConcentration.top1Percent}%</div>
                  <div className="text-xs text-gray-600 mt-1">Top 1 Client</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded">
                  <div className="text-3xl font-bold text-[#707CF1]">{revenueConcentration.top3Percent}%</div>
                  <div className="text-xs text-gray-600 mt-1">Top 3 Clients</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded">
                  <div className="text-3xl font-bold text-[#707CF1]">{revenueConcentration.top5Percent}%</div>
                  <div className="text-xs text-gray-600 mt-1">Top 5 Clients</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded">
                  <div className="text-3xl font-bold text-[#707CF1]">{revenueConcentration.top10Percent}%</div>
                  <div className="text-xs text-gray-600 mt-1">Top 10 Clients</div>
                </div>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm">Top 5 Clients by Revenue</h4>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1">Client</th>
                    <th className="text-right py-1">Revenue</th>
                    <th className="text-right py-1">%</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueConcentration.topClients.map((client, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-1 text-xs">{client.client}</td>
                      <td className="text-right py-1">{formatNumber(client.revenue)}</td>
                      <td className="text-right py-1">{client.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-xs text-gray-600">
              Higher concentration indicates dependency on fewer clients (higher risk)
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default Analytics;
