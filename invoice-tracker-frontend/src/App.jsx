import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Analytics from './Analytics';

const API_URL = 'http://localhost:3001/api';

// Type colors
const TYPE_COLORS = {
  'PS': '#707CF1',
  'Maint': '#00BBBA',
  'Sub': '#151744',
  'Hosting': '#F59E0B',
  'MS': '#5B21B6',  // Dark purple to distinguish from credit memo
  'SW': '#10B981',  // Green color for software
  'HW': '#6366F1',
  '3PP': '#EC4899',
  'Credit Memo': '#DC2626'  // Red color for credit memos
};

// Helper function to display invoice type
const displayInvoiceType = (type) => {
  return type === 'Credit Memo' ? 'CM' : type;
};

// Status colors
const STATUS_COLORS = {
  'Paid': '#10B981',
  'Pending': '#0076A2',
  'Overdue': '#EF4444'
};

function InvoiceTracker({ onNavigateToAnalytics }) {
  const [invoices, setInvoices] = useState([]);
  const [expectedInvoices, setExpectedInvoices] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({});
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [databaseWarning, setDatabaseWarning] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);
  const [clientFilter, setClientFilter] = useState('All');
  const [contractFilter, setContractFilter] = useState('All');
  const [frequencyFilter, setFrequencyFilter] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [agingFilter, setAgingFilter] = useState('All');
  const [activeStatBox, setActiveStatBox] = useState(null);
  const [selectedExpectedInvoiceId, setSelectedExpectedInvoiceId] = useState(null);

  // Dashboard date filter
  const [dashboardDateFilter, setDashboardDateFilter] = useState('allTime');
  const [dashboardCustomFrom, setDashboardCustomFrom] = useState('');
  const [dashboardCustomTo, setDashboardCustomTo] = useState('');
  
  // Grouping
  const [groupBy, setGroupBy] = useState('None');
  const [secondaryGroupBy, setSecondaryGroupBy] = useState('None');
  const [expandedGroups, setExpandedGroups] = useState({});
  const [contractValues, setContractValues] = useState({});
  
  // UI State
  const [showInvoiceTable, setShowInvoiceTable] = useState(false);
  const [showExpectedUnack, setShowExpectedUnack] = useState(false);
  const [showExpectedAck, setShowExpectedAck] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [queryText, setQueryText] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [queryFilteredIds, setQueryFilteredIds] = useState(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [groupingCollapsed, setGroupingCollapsed] = useState(false);

  // Duplicates State
  const [duplicates, setDuplicates] = useState([]);
  const [selectedDuplicate, setSelectedDuplicate] = useState(null);
  const [duplicateDetails, setDuplicateDetails] = useState([]);

  // Server Status
  const [serverStatus, setServerStatus] = useState('checking'); // 'online', 'offline', 'checking'

  // Load contract values from database
  const loadContracts = async () => {
    try {
      const response = await axios.get(`${API_URL}/contracts`);
      const contractsObj = {};
      response.data.forEach(contract => {
        contractsObj[contract.contractName] = {
          value: contract.contractValue,
          currency: contract.currency
        };
      });
      setContractValues(contractsObj);
    } catch (error) {
      console.error('Error loading contracts:', error);
    }
  };

  // Save contract value to database
  const saveContractValue = async (contract, value, currency) => {
    const newValues = {
      ...contractValues,
      [contract]: { value: parseFloat(value), currency: currency || 'USD' }
    };
    setContractValues(newValues);

    try {
      await axios.put(`${API_URL}/contracts/${encodeURIComponent(contract)}`, {
        contractValue: parseFloat(value),
        currency: currency || 'USD'
      });
    } catch (error) {
      console.error('Error saving contract:', error);
      showMessage('error', 'Failed to save contract value');
    }
  };

  // Check database type on mount
  useEffect(() => {
    checkDatabaseType();
  }, []);

  const checkDatabaseType = async () => {
    try {
      const response = await axios.get(`${API_URL}/health`);
      if (response.data.database === 'sqlite') {
        setDatabaseWarning({
          type: 'sqlite',
          message: response.data.warning || 'You are using SQLite backend. Please switch to PostgreSQL for production.'
        });
      }
    } catch (error) {
      console.warn('Could not check database type:', error.message);
    }
  };

  // Load data
  useEffect(() => {
    loadInvoices();
    loadExpectedInvoices();
    loadExchangeRates();
    loadContracts();
    loadDuplicates();
  }, []);

  const loadInvoices = async () => {
    try {
      const response = await axios.get(`${API_URL}/invoices`);
      setInvoices(response.data);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  const loadExpectedInvoices = async () => {
    try {
      const response = await axios.get(`${API_URL}/expected-invoices`);
      setExpectedInvoices(response.data);
    } catch (error) {
      console.error('Error loading expected invoices:', error);
    }
  };

  const loadExchangeRates = async () => {
    try {
      const response = await axios.get(`${API_URL}/exchange-rates`);
      setExchangeRates(response.data);
    } catch (error) {
      console.error('Error loading exchange rates:', error);
    }
  };

  // Convert to USD
  const convertToUSD = (amount, currency) => {
    const rate = exchangeRates[currency] || 1;
    return Math.round(amount * rate);
  };

  // Calculate days overdue
  const getDaysOverdue = (dueDate) => {
    if (!dueDate) return 0;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today - due;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get aging bucket for an invoice
  const getAgingBucket = (invoice) => {
    if (invoice.status === 'Paid') return null;

    const daysOverdue = getDaysOverdue(invoice.dueDate);

    if (daysOverdue <= 0) return 'Current';
    if (daysOverdue <= 30) return 'Current';
    if (daysOverdue <= 60) return '31-60';
    if (daysOverdue <= 90) return '61-90';
    if (daysOverdue <= 120) return '91-120';
    if (daysOverdue <= 180) return '121-180';
    if (daysOverdue <= 270) return '181-270';
    if (daysOverdue <= 365) return '271-365';
    return '>365';
  };

  // Format date (DD-MMM-YY)
  const formatDate = (dateStr) => {
    if (!dateStr) return '';

    // Parse date string directly to avoid timezone issues
    // Expected format: YYYY-MM-DD
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length !== 3) return '';

    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // 0-indexed
    const day = parseInt(parts[2]);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return '';

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayStr = String(day).padStart(2, '0');
    const monthStr = months[month];
    const yearStr = String(year).slice(-2); // 2-digit year
    return `${dayStr}-${monthStr}-${yearStr}`;
  };

  // Show message
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // Handle file upload
  const handleFileUpload = async (files) => {
    setLoading(true);
    const formData = new FormData();
    
    const pdfFiles = [];
    const excelFiles = [];
    
    Array.from(files).forEach(file => {
      if (file.type === 'application/pdf') {
        pdfFiles.push(file);
      } else if (file.type.includes('spreadsheet') || file.type.includes('excel') || file.name.endsWith('.csv')) {
        excelFiles.push(file);
      }
    });
    
    try {
      // Upload PDFs
      if (pdfFiles.length > 0) {
        const pdfFormData = new FormData();
        pdfFiles.forEach(file => pdfFormData.append('pdfs', file));
        
        const response = await axios.post(`${API_URL}/upload-pdfs`, pdfFormData);

        if (response.data.duplicates && response.data.duplicates.length > 0) {
          const dupList = response.data.duplicates.map(d => d.invoiceNumber).join(', ');
          showMessage('warning', `Duplicate invoice numbers detected and uploaded: ${dupList}. Use the Duplicate Management section to review.`);
        }

        showMessage('success', `Uploaded ${response.data.invoices.length} invoices`);
        await loadInvoices();
        await loadExpectedInvoices();
        await loadDuplicates();
      }
      
      // Upload payment spreadsheet
      if (excelFiles.length > 0) {
        const excelFormData = new FormData();
        excelFormData.append('spreadsheet', excelFiles[0]);
        
        const response = await axios.post(`${API_URL}/upload-payments`, excelFormData);
        showMessage('success', `Updated ${response.data.updatedCount} invoice payments`);
        await loadInvoices();
      }
      
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target === e.currentTarget) {
      setDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    return () => window.removeEventListener('dragenter', handleDragEnter);
  }, []);

  // Server health check
  const checkServerStatus = async () => {
    try {
      await axios.get(`${API_URL}/health`, { timeout: 3000 });
      setServerStatus('online');
    } catch (error) {
      setServerStatus('offline');
    }
  };

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(checkServerStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Helper function to check if invoice matches a status filter option
  const matchesStatusFilter = (inv, statusOption) => {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    switch (statusOption) {
      case 'Overdue':
        return inv.status === 'Pending' && inv.dueDate < today;
      case 'Current Unpaid':
        return inv.status === 'Pending' && inv.dueDate >= today;
      case 'Due This Month':
        return inv.status === 'Pending' && inv.dueDate && inv.dueDate.startsWith(thisMonth);
      case 'Paid':
      case 'Pending':
        return inv.status === statusOption;
      default:
        return false;
    }
  };

  // Filter invoices
  const getFilteredInvoices = () => {
    let filtered = [...invoices];

    // Status filter (multi-select)
    if (statusFilter.length > 0) {
      filtered = filtered.filter(inv =>
        statusFilter.some(status => matchesStatusFilter(inv, status))
      );
    }

    // Aging filter
    if (agingFilter !== 'All') {
      filtered = filtered.filter(inv => {
        const bucket = getAgingBucket(inv);
        return bucket === agingFilter && inv.invoiceType !== 'Credit Memo';
      });
    }

    // Type filter (multi-select)
    if (typeFilter.length > 0) {
      filtered = filtered.filter(inv => typeFilter.includes(inv.invoiceType));
    }

    // Client filter
    if (clientFilter !== 'All') {
      filtered = filtered.filter(inv => inv.client === clientFilter);
    }

    // Contract filter
    if (contractFilter !== 'All') {
      filtered = filtered.filter(inv => inv.customerContract === contractFilter);
    }

    // Frequency filter
    if (frequencyFilter.length > 0) {
      filtered = filtered.filter(inv => frequencyFilter.includes(inv.frequency));
    }

    // Date range filter (by due date)
    if (dateFrom) {
      filtered = filtered.filter(inv => inv.dueDate >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(inv => inv.dueDate <= dateTo);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.invoiceNumber?.toLowerCase().includes(term) ||
        inv.client?.toLowerCase().includes(term) ||
        inv.customerContract?.toLowerCase().includes(term) ||
        inv.services?.toLowerCase().includes(term)
      );
    }

    // Query filter (AI natural language query results)
    if (queryFilteredIds) {
      filtered = filtered.filter(inv => queryFilteredIds.includes(inv.id));
    }

    return filtered;
  };

  // Get dashboard date range
  const getDashboardDateRange = () => {
    if (dashboardDateFilter === 'year') {
      const year = new Date().getFullYear();
      return {
        from: `${year}-01-01`,
        to: `${year}-12-31`
      };
    } else if (dashboardDateFilter === 'allTime') {
      return {
        from: null,
        to: null
      };
    } else {
      return {
        from: dashboardCustomFrom,
        to: dashboardCustomTo
      };
    }
  };

  // Calculate statistics
  const calculateStats = () => {
    const dateRange = getDashboardDateRange();
    let filtered = invoices;

    if (dateRange.from) {
      filtered = filtered.filter(inv => inv.invoiceDate >= dateRange.from);
    }
    if (dateRange.to) {
      filtered = filtered.filter(inv => inv.invoiceDate <= dateRange.to);
    }

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    // Separate credit memos from regular invoices
    const creditMemos = filtered.filter(inv => inv.invoiceType === 'Credit Memo');
    const regularInvoices = filtered.filter(inv => inv.invoiceType !== 'Credit Memo');

    // Credit memo totals (negative amounts)
    const totalCreditMemos = creditMemos.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);
    const creditMemosCount = creditMemos.length;

    // Regular invoice stats (excluding credit memos)
    const totalInvoiced = regularInvoices.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);
    const totalPaid = regularInvoices.filter(inv => inv.status === 'Paid').reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

    const unpaidInvoices = regularInvoices.filter(inv => inv.status === 'Pending');
    const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

    const overdue = regularInvoices.filter(inv => inv.status === 'Pending' && inv.dueDate < today);
    const overdueAmount = overdue.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

    const currentUnpaidInvoices = regularInvoices.filter(inv => inv.status === 'Pending' && inv.dueDate >= today);
    const currentUnpaid = currentUnpaidInvoices.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

    const dueThisMonthInvoices = regularInvoices.filter(inv => inv.status === 'Pending' && inv.dueDate && inv.dueDate.startsWith(thisMonth));
    const dueThisMonth = dueThisMonthInvoices.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

    return {
      totalInvoiced,
      totalPaid,
      totalUnpaid,
      unpaidCount: unpaidInvoices.length,
      outstanding: totalUnpaid,
      overdueAmount,
      overdueCount: overdue.length,
      currentUnpaid,
      currentUnpaidCount: currentUnpaidInvoices.length,
      dueThisMonth,
      dueThisMonthCount: dueThisMonthInvoices.length,
      totalCreditMemos,
      creditMemosCount
    };
  };

  // Group invoices
  const groupInvoices = (invoicesToGroup) => {
    let grouped = {};

    if (groupBy === 'None') {
      grouped = { 'All Invoices': invoicesToGroup };
    } else {
      invoicesToGroup.forEach(inv => {
        let primaryKey = inv[groupBy === 'Client' ? 'client' :
                             groupBy === 'Contract' ? 'customerContract' :
                             groupBy === 'Status' ? 'status' : 'invoiceType'] || 'Uncategorized';

        if (secondaryGroupBy !== 'None') {
          let secondaryKey = inv[secondaryGroupBy === 'Client' ? 'client' :
                                 secondaryGroupBy === 'Contract' ? 'customerContract' :
                                 secondaryGroupBy === 'Status' ? 'status' : 'invoiceType'] || 'Uncategorized';
          primaryKey = `${primaryKey} > ${secondaryKey}`;
        }

        if (!grouped[primaryKey]) grouped[primaryKey] = [];
        grouped[primaryKey].push(inv);
      });
    }

    // Sort invoices within each group by invoice date (newest first)
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => {
        // Sort by invoice date (newest first)
        const dateA = new Date(a.invoiceDate);
        const dateB = new Date(b.invoiceDate);
        return dateB - dateA; // Newest first (descending order)
      });
    });

    return grouped;
  };

  // Calculate aging statistics
  const calculateAgingStats = () => {
    // Exclude credit memos from aging report (only regular unpaid invoices)
    const unpaidInvoices = invoices.filter(inv => inv.status === 'Pending' && inv.invoiceType !== 'Credit Memo');

    const buckets = {
      'Current': { count: 0, total: 0, invoices: [] },
      '31-60': { count: 0, total: 0, invoices: [] },
      '61-90': { count: 0, total: 0, invoices: [] },
      '91-120': { count: 0, total: 0, invoices: [] },
      '121-180': { count: 0, total: 0, invoices: [] },
      '181-270': { count: 0, total: 0, invoices: [] },
      '271-365': { count: 0, total: 0, invoices: [] },
      '>365': { count: 0, total: 0, invoices: [] }
    };

    unpaidInvoices.forEach(inv => {
      const bucket = getAgingBucket(inv);
      // Double-check to exclude credit memos (defensive coding)
      if (bucket && buckets[bucket] && inv.invoiceType !== 'Credit Memo') {
        const amount = convertToUSD(inv.amountDue, inv.currency);
        // Only add positive amounts (credit memos should already be filtered but this is extra safety)
        if (amount > 0) {
          buckets[bucket].count++;
          buckets[bucket].total += amount;
          buckets[bucket].invoices.push(inv);
        } else if (amount < 0) {
          // Log any negative amounts that slip through (shouldn't happen)
          console.warn('Negative amount in aging bucket:', inv.invoiceNumber, inv.invoiceType, amount);
        }
      }
    });

    return buckets;
  };

  // Clear filters
  const clearFilters = () => {
    setStatusFilter([]);
    setTypeFilter([]);
    setClientFilter('All');
    setContractFilter('All');
    setFrequencyFilter([]);
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setAgingFilter('All');
    setActiveStatBox(null);
    setQueryFilteredIds(null);
    setQueryResult(null);
  };

  // Toggle frequency filter selection
  const toggleFrequency = (frequency) => {
    if (frequencyFilter.includes(frequency)) {
      setFrequencyFilter(frequencyFilter.filter(f => f !== frequency));
    } else {
      setFrequencyFilter([...frequencyFilter, frequency]);
    }
  };

  // Toggle type filter selection
  const toggleType = (type) => {
    if (typeFilter.includes(type)) {
      setTypeFilter(typeFilter.filter(t => t !== type));
    } else {
      setTypeFilter([...typeFilter, type]);
    }
  };

  // Toggle status filter selection
  const toggleStatus = (status) => {
    if (statusFilter.includes(status)) {
      setStatusFilter(statusFilter.filter(s => s !== status));
    } else {
      setStatusFilter([...statusFilter, status]);
    }
  };

  // Handle stat click
  const handleStatClick = (statType) => {
    clearFilters();
    setActiveStatBox(statType);
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    switch (statType) {
      case 'totalInvoiced':
        setShowInvoiceTable(true);
        break;
      case 'paid':
        setStatusFilter(['Paid']);
        break;
      case 'unpaid':
        setStatusFilter(['Pending']);
        break;
      case 'overdue':
        setStatusFilter(['Overdue']);
        break;
      case 'currentUnpaid':
        setStatusFilter(['Current Unpaid']);
        break;
      case 'dueThisMonth':
        setStatusFilter(['Due This Month']);
        setShowInvoiceTable(true);
        break;
    }
  };

  // Handle aging bucket click
  const handleAgingClick = (bucket) => {
    clearFilters();
    setActiveStatBox('aging-' + bucket);
    setAgingFilter(bucket);
    setShowInvoiceTable(true);
  };

  // Mark as paid/unpaid
  const updateInvoiceStatus = async (id, status) => {
    try {
      // Find the invoice being updated
      const invoice = invoices.find(inv => inv.id === id);

      await axios.put(`${API_URL}/invoices/${id}`, {
        status,
        paymentDate: status === 'Paid' ? new Date().toISOString().split('T')[0] : null
      });
      await loadInvoices();

      // Check if invoice is in current dashboard period
      const dateRange = getDashboardDateRange();
      const isInPeriod = (!dateRange.from || invoice.invoiceDate >= dateRange.from) &&
                         (!dateRange.to || invoice.invoiceDate <= dateRange.to);

      if (!isInPeriod && status === 'Paid') {
        showMessage('success', `Invoice marked as ${status}. Note: This invoice is outside the current dashboard period (invoice date: ${formatDate(invoice.invoiceDate)})`);
      } else {
        showMessage('success', `Invoice marked as ${status}`);
      }
    } catch (error) {
      showMessage('error', 'Failed to update invoice');
    }
  };

  // Delete invoice
  const deleteInvoice = async (id) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;

    try {
      await axios.delete(`${API_URL}/invoices/${id}`);
      await loadInvoices();
      await loadDuplicates();

      // Reload duplicate details if viewing them
      if (selectedDuplicate) {
        await loadDuplicateDetails(selectedDuplicate);
      }

      setSelectedInvoice(null);
      setEditingInvoice(null);
      showMessage('success', 'Invoice deleted');
    } catch (error) {
      showMessage('error', 'Failed to delete invoice');
    }
  };

  // Delete ALL invoices (DEVELOPMENT ONLY)
  const deleteAllInvoices = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL invoices and their PDF files. Are you absolutely sure?')) return;
    if (!window.confirm('This action cannot be undone. Delete ALL invoices?')) return;

    try {
      const response = await axios.delete(`${API_URL}/invoices`);
      await loadInvoices();
      await loadExpectedInvoices();
      showMessage('success', `Deleted ${response.data.deletedInvoices} invoices and ${response.data.deletedFiles} PDF files`);
    } catch (error) {
      showMessage('error', 'Failed to delete all invoices');
    }
  };

  // Edit invoice
  const startEditInvoice = (invoice) => {
    setEditingInvoice(invoice);
    setEditForm({
      invoiceNumber: invoice.invoiceNumber,
      client: invoice.client,
      customerContract: invoice.customerContract || '',
      poNumber: invoice.poNumber || '',
      invoiceType: invoice.invoiceType,
      amountDue: invoice.amountDue,
      currency: invoice.currency,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      services: invoice.services || '',
      frequency: invoice.frequency || 'adhoc'
    });
  };

  const saveEditInvoice = async () => {
    try {
      await axios.put(`${API_URL}/invoices/${editingInvoice.id}`, editForm);
      await loadInvoices();
      setEditingInvoice(null);
      setSelectedInvoice(null);
      showMessage('success', 'Invoice updated');
    } catch (error) {
      showMessage('error', 'Failed to update invoice');
    }
  };

  // Expected invoice actions
  const acknowledgeExpected = async (id, ack) => {
    try {
      await axios.put(`${API_URL}/expected-invoices/${id}`, { acknowledged: ack });
      await loadExpectedInvoices();
      showMessage('success', ack ? 'Expected invoice acknowledged' : 'Expected invoice unacknowledged');
    } catch (error) {
      showMessage('error', 'Failed to update expected invoice');
    }
  };

  const deleteExpected = async (id) => {
    if (!window.confirm('Delete this expected invoice?')) return;

    try {
      await axios.delete(`${API_URL}/expected-invoices/${id}`);
      await loadExpectedInvoices();
      showMessage('success', 'Expected invoice deleted');
    } catch (error) {
      showMessage('error', 'Failed to delete expected invoice');
    }
  };

  // Filter by contract from expected invoices
  const filterByContract = (contract, expectedInvoiceId) => {
    if (contract && contract !== '-') {
      setContractFilter(contract);
      setSelectedExpectedInvoiceId(expectedInvoiceId);
      setShowInvoiceTable(true);
      // Scroll to invoice table after a short delay to allow state to update
      setTimeout(() => {
        const invoiceTable = document.querySelector('[class*="Invoices"]');
        if (invoiceTable) {
          invoiceTable.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  };

  // Duplicates Management
  const loadDuplicates = async () => {
    try {
      const response = await axios.get(`${API_URL}/duplicates`);
      setDuplicates(response.data);
    } catch (error) {
      console.error('Error loading duplicates:', error);
      showMessage('error', 'Failed to load duplicates');
    }
  };

  const loadDuplicateDetails = async (invoiceNumber) => {
    try {
      const response = await axios.get(`${API_URL}/invoices/duplicates/${encodeURIComponent(invoiceNumber)}`);
      setDuplicateDetails(response.data);
      setSelectedDuplicate(invoiceNumber);
    } catch (error) {
      console.error('Error loading duplicate details:', error);
      showMessage('error', 'Failed to load duplicate details');
    }
  };

  const deleteDuplicates = async (invoiceNumber) => {
    if (!window.confirm(`Delete all duplicate invoices for "${invoiceNumber}" except the most recent?`)) return;

    try {
      await axios.delete(`${API_URL}/invoices/duplicates/${encodeURIComponent(invoiceNumber)}`);
      await loadDuplicates();
      await loadInvoices();
      setSelectedDuplicate(null);
      setDuplicateDetails([]);
      showMessage('success', 'Duplicate invoices deleted');
    } catch (error) {
      showMessage('error', 'Failed to delete duplicates');
    }
  };

  // Natural language query
  const handleQuery = async () => {
    if (!queryText.trim()) return;

    try {
      const response = await axios.post(`${API_URL}/query`, { query: queryText });
      setQueryResult(response.data);

      // If the response includes invoices, filter the invoice table to show only those
      if (response.data.invoices && response.data.invoices.length > 0) {
        // Clear all other filters so we only show the AI query results
        setStatusFilter('All');
        setTypeFilter('All');
        setClientFilter('All');
        setContractFilter('All');
        setSearchTerm('');
        setDateFrom('');
        setDateTo('');
        setAgingFilter('All');
        setActiveStatBox(null);

        // Set the query filter and show the table
        const invoiceIds = response.data.invoices.map(inv => inv.id);
        setQueryFilteredIds(invoiceIds);
        setShowInvoiceTable(true);
      }
    } catch (error) {
      showMessage('error', 'Query failed');
    }
  };

  // Get unique values for filters
  const clients = [...new Set(invoices.map(inv => inv.client))].sort();
  const contracts = [...new Set(invoices.map(inv => inv.customerContract).filter(Boolean))].sort();

  const stats = calculateStats();
  const agingStats = calculateAgingStats();
  const filteredInvoices = getFilteredInvoices();
  const groupedInvoices = groupInvoices(filteredInvoices);

  // Sort expected invoices by expected date (newest first)
  const sortedExpectedInvoices = [...expectedInvoices].sort((a, b) => {
    return new Date(b.expectedDate) - new Date(a.expectedDate);
  });

  const unacknowledgedExpected = sortedExpectedInvoices.filter(e => !e.acknowledged);
  const acknowledgedExpected = sortedExpectedInvoices.filter(e => e.acknowledged);

  return (
    <div className="min-h-screen bg-[#393392] p-4 md:p-8" style={{ fontFamily: 'Aptos, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }} onDragOver={handleDragOver}>
      {/* Drag overlay */}
      {dragOver && (
        <div 
          className="fixed inset-0 bg-blue-600 bg-opacity-90 z-50 flex items-center justify-center"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-white text-center">
            <div className="text-6xl mb-4">📄</div>
            <div className="text-3xl font-bold mb-2">Drop Files Here</div>
            <div className="text-xl">PDFs or Excel/CSV payment spreadsheet</div>
          </div>
        </div>
      )}

      {/* Database Warning Banner */}
      {databaseWarning && (
        <div className="max-w-7xl mx-auto mb-4">
          <div className="bg-red-600 border-2 border-red-800 rounded-lg p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="text-3xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-lg mb-1">
                  SQLite Backend Detected - Not Recommended for Production
                </h3>
                <p className="text-red-100 text-sm mb-2">
                  {databaseWarning.message}
                </p>
                <div className="bg-red-800 rounded p-3 text-white text-xs font-mono">
                  <p className="mb-1">To fix this issue:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Stop the current server (Ctrl+C)</li>
                    <li>Start PostgreSQL server: <code className="bg-red-900 px-1 rounded">node server-postgres.js</code></li>
                    <li>Or use the batch file in C:\Users\dwils\Desktop\Invoice Tracker</li>
                  </ol>
                </div>
              </div>
              <button
                onClick={() => setDatabaseWarning(null)}
                className="text-white hover:text-red-200 text-2xl leading-none"
                title="Dismiss warning"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Altera Logo" className="h-12 w-auto" />
            <h1 className="text-4xl font-bold text-white">APAC Invoice Tracker</h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Server Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white bg-opacity-20 rounded-lg">
              <div className={`w-3 h-3 rounded-full ${
                serverStatus === 'online' ? 'bg-green-500' :
                serverStatus === 'offline' ? 'bg-red-500' :
                'bg-yellow-500'
              }`} />
              <span className="text-sm text-white font-medium">
                {serverStatus === 'online' ? 'Server Online' :
                 serverStatus === 'offline' ? 'Server Offline' :
                 'Checking...'}
              </span>
            </div>
            <button
              onClick={onNavigateToAnalytics}
              className="px-6 py-3 bg-white text-[#707CF1] rounded-lg hover:bg-gray-100 transition shadow font-semibold"
            >
              View Analytics →
            </button>
          </div>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-100 text-green-800' :
            message.type === 'error' ? 'bg-red-100 text-red-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Upload buttons */}
        <div className="mb-6 flex gap-4 flex-wrap">
          <label className="px-6 py-3 bg-[#151744] text-white rounded-lg hover:bg-[#0d0e2a] cursor-pointer transition">
            Upload PDFs
            <input
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </label>

          <label className="px-6 py-3 bg-[#00BBBA] text-black rounded-lg hover:bg-[#009a99] cursor-pointer transition">
            Upload Payment Sheet
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </label>

          {/* Hide Delete All button after Nov 1, 2025 */}
          {new Date() < new Date('2025-11-01') && (
            <button
              onClick={deleteAllInvoices}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition border-2 border-red-800"
            >
              🗑️ Delete All Invoices (DEV)
            </button>
          )}
        </div>

        {/* Dashboard date filter */}
        <div className="mb-6 bg-[#707CF1] p-4 rounded-lg shadow">
          <div className="flex gap-4 items-center flex-wrap">
            <label className="font-semibold text-white">Dashboard Period:</label>
            <select
              value={dashboardDateFilter}
              onChange={(e) => setDashboardDateFilter(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="allTime">All Time</option>
              <option value="year">This Calendar Year</option>
              <option value="custom">Custom Period</option>
            </select>

            {dashboardDateFilter === 'custom' && (
              <>
                <input
                  type="date"
                  value={dashboardCustomFrom}
                  onChange={(e) => setDashboardCustomFrom(e.target.value)}
                  className="border rounded px-3 py-2"
                  placeholder="From"
                />
                <input
                  type="date"
                  value={dashboardCustomTo}
                  onChange={(e) => setDashboardCustomTo(e.target.value)}
                  className="border rounded px-3 py-2"
                  placeholder="To"
                />
              </>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="mb-8">
          {/* First row - 4 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div
              className={`bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition border-l-8 border-blue-500 ${activeStatBox === 'totalInvoiced' ? 'ring-4 ring-blue-300 shadow-xl' : ''}`}
              onClick={() => handleStatClick('totalInvoiced')}
            >
              <div className="text-gray-600 text-sm font-medium">Total Invoiced</div>
              <div className="text-3xl font-bold text-blue-500 my-2">${stats.totalInvoiced.toLocaleString()}</div>
              <div className="text-xs text-gray-500">All invoices in selected period</div>
            </div>

            <div
              className={`bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition border-l-8 border-green-500 ${activeStatBox === 'paid' ? 'ring-4 ring-green-300 shadow-xl' : ''}`}
              onClick={() => handleStatClick('paid')}
            >
              <div className="text-gray-600 text-sm font-medium">Total Paid</div>
              <div className="text-3xl font-bold text-green-500 my-2">${stats.totalPaid.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Invoices marked as paid</div>
            </div>

            <div
              className={`bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition border-l-8 border-yellow-500 ${activeStatBox === 'unpaid' ? 'ring-4 ring-yellow-300 shadow-xl' : ''}`}
              onClick={() => handleStatClick('unpaid')}
            >
              <div className="text-gray-600 text-sm font-medium flex items-center gap-1">
                Total Unpaid
                <span className="text-xs text-gray-400" title="All invoices not yet paid, including those not yet due">ⓘ</span>
              </div>
              <div className="text-3xl font-bold text-yellow-500 my-2">${stats.totalUnpaid.toLocaleString()}</div>
              <div className="text-xs text-gray-500">All pending invoices ({stats.unpaidCount})</div>
            </div>

            <div
              className={`bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition border-l-8 border-red-500 ${activeStatBox === 'overdue' ? 'ring-4 ring-red-300 shadow-xl' : ''}`}
              onClick={() => handleStatClick('overdue')}
            >
              <div className="text-gray-600 text-sm font-medium flex items-center gap-1">
                Overdue
                <span className="text-xs text-gray-400" title="Unpaid invoices past their due date">ⓘ</span>
              </div>
              <div className="text-3xl font-bold text-red-500 my-2">${stats.overdueAmount.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Past due date ({stats.overdueCount} invoices)</div>
            </div>
          </div>

          {/* Second row - 3 columns centered */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <div
              className={`bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition border-l-8 border-orange-500 ${activeStatBox === 'currentUnpaid' ? 'ring-4 ring-orange-300 shadow-xl' : ''}`}
              onClick={() => handleStatClick('currentUnpaid')}
            >
              <div className="text-gray-600 text-sm font-medium flex items-center gap-1">
                Current Unpaid
                <span className="text-xs text-gray-400" title="Unpaid invoices not yet overdue">ⓘ</span>
              </div>
              <div className="text-3xl font-bold text-orange-500 my-2">${stats.currentUnpaid.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Not yet due ({stats.currentUnpaidCount} invoices)</div>
            </div>

            <div
              className={`bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition border-l-8 border-purple-500 ${activeStatBox === 'dueThisMonth' ? 'ring-4 ring-purple-300 shadow-xl' : ''}`}
              onClick={() => handleStatClick('dueThisMonth')}
            >
              <div className="text-gray-600 text-sm font-medium">Due This Month</div>
              <div className="text-3xl font-bold text-purple-500 my-2">${stats.dueThisMonth.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Unpaid, due in current month ({stats.dueThisMonthCount} invoices)</div>
            </div>

            <div
              className={`bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition border-l-8 border-pink-500 ${activeStatBox === 'creditMemo' ? 'ring-4 ring-pink-300 shadow-xl' : ''}`}
              onClick={() => {
                clearFilters();
                setActiveStatBox('creditMemo');
                setStatusFilter('All');
                setTypeFilter('Credit Memo');
                setClientFilter('All');
                setContractFilter('All');
                setAgingFilter('All');
                setSearchTerm('');
                setDateFrom('');
                setDateTo('');
                setShowInvoiceTable(true);
              }}
            >
              <div className="text-gray-600 text-sm font-medium flex items-center gap-1">
                Total Credit Memos
                <span className="text-xs text-gray-400" title="Credit memos issued (negative amounts)">ⓘ</span>
              </div>
              <div className="text-3xl font-bold text-pink-500 my-2">${Math.abs(stats.totalCreditMemos).toLocaleString()}</div>
              <div className="text-xs text-gray-500">Credits issued ({stats.creditMemosCount} memos)</div>
            </div>
          </div>
        </div>

        {/* Aged Invoice Report */}
        <div className="mb-6 bg-[#707CF1] p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4 text-white">Aged Invoice Report (Unpaid Only)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {Object.keys(agingStats).map(bucket => {
              const data = agingStats[bucket];
              const isActive = activeStatBox === 'aging-' + bucket;

              // Color scheme based on aging severity
              const getColor = () => {
                if (bucket === 'Current') return 'bg-green-100 hover:bg-green-200 border-green-300 border-l-green-500 text-green-800';
                if (bucket === '31-60') return 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300 border-l-yellow-500 text-yellow-800';
                if (bucket === '61-90') return 'bg-orange-100 hover:bg-orange-200 border-orange-300 border-l-orange-500 text-orange-800';
                if (bucket === '91-120') return 'bg-red-100 hover:bg-red-200 border-red-300 border-l-red-500 text-red-800';
                if (bucket === '121-180') return 'bg-red-200 hover:bg-red-300 border-red-400 border-l-red-600 text-red-900';
                if (bucket === '181-270') return 'bg-purple-100 hover:bg-purple-200 border-purple-300 border-l-purple-500 text-purple-800';
                if (bucket === '271-365') return 'bg-purple-200 hover:bg-purple-300 border-purple-400 border-l-purple-600 text-purple-900';
                return 'bg-gray-200 hover:bg-gray-300 border-gray-400 border-l-gray-600 text-gray-900';
              };

              const activeClass = isActive ? 'ring-4 ring-white shadow-2xl scale-110' : '';

              return (
                <div
                  key={bucket}
                  onClick={() => handleAgingClick(bucket)}
                  className={`${getColor()} ${activeClass} p-4 rounded-lg border-2 border-l-8 cursor-pointer transition-all transform hover:scale-105 min-w-0`}
                >
                  <div className="text-xs font-semibold mb-1">
                    {bucket === 'Current' ? 'Current' : `${bucket} days`}
                  </div>
                  <div className="text-lg font-bold mb-1 break-words">
                    ${data.total.toLocaleString()}
                  </div>
                  <div className="text-xs opacity-75">
                    {data.count} invoice{data.count !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-white">
            Click on any aging bucket to filter invoices. Current = not yet due or up to 30 days overdue.
          </div>
        </div>

        {/* Natural Language Query */}
        <div className="mb-6 bg-[#707CF1] p-4 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-3 text-white">Ask About Your Invoices</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={queryText}
              onChange={(e) => {
                setQueryText(e.target.value);
                // Clear results when query box is emptied
                if (!e.target.value.trim()) {
                  setQueryResult(null);
                  setQueryFilteredIds(null);
                  setShowInvoiceTable(false);
                }
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
              placeholder="E.g., 'What's the total for PS invoices from Acme Corp?'"
              className="flex-1 border rounded px-4 py-2"
            />
            <button
              onClick={handleQuery}
              className="px-6 py-2 bg-[#151744] text-white rounded hover:bg-[#0d0e2a] transition"
            >
              Ask
            </button>
            <button
              onClick={() => {
                setQueryText('');
                setQueryResult(null);
                setQueryFilteredIds(null);
                setShowInvoiceTable(false);
              }}
              className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
            >
              Clear
            </button>
          </div>
          
          {queryResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              {queryResult.type === 'total' ? (
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    ${queryResult.value.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">{queryResult.count} invoices</div>
                </div>
              ) : queryResult.type === 'count' ? (
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    {queryResult.count}
                  </div>
                  <div className="text-sm text-gray-600">invoices found</div>
                </div>
              ) : queryResult.type === 'average' ? (
                <div>
                  <div className="text-2xl font-bold text-purple-600">
                    ${queryResult.value.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    Average of {queryResult.count} invoices (Total: ${queryResult.total.toLocaleString()})
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-gray-600 mb-2">Found {queryResult.count} invoices</div>
                  <div className="max-h-40 overflow-y-auto">
                    {queryResult.invoices.slice(0, 10).map(inv => (
                      <div key={inv.id} className="text-sm py-1">
                        {inv.invoiceNumber} - {inv.client} - ${convertToUSD(inv.amountDue, inv.currency).toLocaleString()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expected Invoices */}
        <div className="mb-6">
          {/* Unacknowledged */}
          <div className="bg-[#707CF1] rounded-lg shadow mb-2">
            <button
              onClick={() => setShowExpectedUnack(!showExpectedUnack)}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-[#5a6ad9] transition"
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg text-white">
                  Expected Invoices - Unacknowledged ({unacknowledgedExpected.length})
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExpectedUnack(!showExpectedUnack);
                  }}
                  className="px-3 py-1 bg-[#151744] text-white rounded hover:bg-[#0d0e2a] transition text-sm flex items-center gap-1"
                  title={showExpectedUnack ? "Collapse Section" : "Expand Section"}
                >
                  {showExpectedUnack ? (
                    <>
                      <span>▲</span>
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <span>▼</span>
                      <span>Show</span>
                    </>
                  )}
                </button>
              </div>
            </button>
            
            {showExpectedUnack && unacknowledgedExpected.length > 0 && (
              <div className="px-6 pb-4">
                <div className="overflow-x-auto bg-white rounded">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Client</th>
                        <th className="px-4 py-2 text-left">Contract</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Expected Date</th>
                        <th className="px-4 py-2 text-left">Amount</th>
                        <th className="px-4 py-2 text-left">Frequency</th>
                        <th className="px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unacknowledgedExpected.map(exp => (
                        <tr
                          key={exp.id}
                          className={`border-t hover:bg-gray-50 ${selectedExpectedInvoiceId === exp.id ? 'bg-yellow-100 ring-2 ring-yellow-400' : ''}`}
                        >
                          <td className="px-4 py-2 text-gray-900">{exp.client}</td>
                          <td className="px-4 py-2">
                            {exp.customerContract ? (
                              <button
                                onClick={() => filterByContract(exp.customerContract, exp.id)}
                                className="text-[#0076A2] hover:text-[#005a7a] underline cursor-pointer font-medium"
                              >
                                {exp.customerContract}
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className="px-2 py-1 rounded text-white text-xs inline-block text-center min-w-[85px] whitespace-nowrap"
                              style={{ backgroundColor: TYPE_COLORS[exp.invoiceType] || '#6B7280' }}
                            >
                              {exp.invoiceType}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{formatDate(exp.expectedDate)}</td>
                          <td className="px-4 py-2">
                            <div className="font-semibold text-gray-900">${convertToUSD(exp.expectedAmount, exp.currency).toLocaleString()} USD</div>
                            <div className="text-xs text-gray-600">
                              ${Math.round(exp.expectedAmount).toLocaleString()} {exp.currency}
                            </div>
                          </td>
                          <td className="px-4 py-2 capitalize text-gray-900">{exp.frequency}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => acknowledgeExpected(exp.id, true)}
                              className="px-3 py-1 bg-[#151744] text-white rounded text-sm hover:bg-[#0d0e2a] mr-2"
                            >
                              Acknowledge
                            </button>
                            <button
                              onClick={() => deleteExpected(exp.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Acknowledged */}
          <div className="bg-[#707CF1] rounded-lg shadow">
            <button
              onClick={() => setShowExpectedAck(!showExpectedAck)}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-[#5a6ad9] transition"
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg text-white">
                  Expected Invoices - Acknowledged ({acknowledgedExpected.length})
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExpectedAck(!showExpectedAck);
                  }}
                  className="px-3 py-1 bg-[#151744] text-white rounded hover:bg-[#0d0e2a] transition text-sm flex items-center gap-1"
                  title={showExpectedAck ? "Collapse Section" : "Expand Section"}
                >
                  {showExpectedAck ? (
                    <>
                      <span>▲</span>
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <span>▼</span>
                      <span>Show</span>
                    </>
                  )}
                </button>
              </div>
            </button>
            
            {showExpectedAck && acknowledgedExpected.length > 0 && (
              <div className="px-6 pb-4">
                <div className="overflow-x-auto bg-white rounded">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Client</th>
                        <th className="px-4 py-2 text-left">Contract</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-left">Expected Date</th>
                        <th className="px-4 py-2 text-left">Amount</th>
                        <th className="px-4 py-2 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acknowledgedExpected.map(exp => (
                        <tr
                          key={exp.id}
                          className={`border-t hover:bg-gray-50 ${selectedExpectedInvoiceId === exp.id ? 'bg-yellow-100 ring-2 ring-yellow-400' : ''}`}
                        >
                          <td className="px-4 py-2 text-gray-900">{exp.client}</td>
                          <td className="px-4 py-2">
                            {exp.customerContract ? (
                              <button
                                onClick={() => filterByContract(exp.customerContract, exp.id)}
                                className="text-[#0076A2] hover:text-[#005a7a] underline cursor-pointer font-medium"
                              >
                                {exp.customerContract}
                              </button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className="px-2 py-1 rounded text-white text-xs inline-block text-center min-w-[85px] whitespace-nowrap"
                              style={{ backgroundColor: TYPE_COLORS[exp.invoiceType] || '#6B7280' }}
                            >
                              {exp.invoiceType}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{formatDate(exp.expectedDate)}</td>
                          <td className="px-4 py-2">
                            <div className="font-semibold text-gray-900">${convertToUSD(exp.expectedAmount, exp.currency).toLocaleString()} USD</div>
                            <div className="text-xs text-gray-600">
                              ${Math.round(exp.expectedAmount).toLocaleString()} {exp.currency}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => acknowledgeExpected(exp.id, false)}
                              className="px-3 py-1 bg-[#0076A2] text-white rounded text-sm hover:bg-[#005a7a] mr-2"
                            >
                              Unacknowledge
                            </button>
                            <button
                              onClick={() => deleteExpected(exp.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Duplicate Invoices Management */}
        <div className="bg-white rounded-lg shadow mb-6">
          <button
            onClick={() => setShowDuplicates(!showDuplicates)}
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg text-red-600">
                Duplicate Invoices ({duplicates.length})
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDuplicates(!showDuplicates);
                }}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm flex items-center gap-1"
                title={showDuplicates ? "Collapse Section" : "Expand Section"}
              >
                {showDuplicates ? (
                  <>
                    <span>▲</span>
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <span>▼</span>
                    <span>Show</span>
                  </>
                )}
              </button>
            </div>
          </button>

          {showDuplicates && (
            <div className="px-6 pb-6">
              {duplicates.length === 0 ? (
                <p className="text-gray-500 italic">No duplicate invoices found</p>
              ) : (
                <div>
                  <div className="mb-4 text-sm text-gray-600">
                    <p>These invoice numbers appear multiple times in the system. Click "View Details" to see all instances, or "Delete Duplicates" to keep only the most recent version.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border rounded">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Invoice Number</th>
                          <th className="px-4 py-2 text-left">Count</th>
                          <th className="px-4 py-2 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duplicates.map(dup => (
                          <tr key={dup.invoiceNumber} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-900">{dup.invoiceNumber}</td>
                            <td className="px-4 py-2 text-gray-900">{dup.count}</td>
                            <td className="px-4 py-2">
                              <button
                                onClick={() => loadDuplicateDetails(dup.invoiceNumber)}
                                className="px-3 py-1 bg-[#0076A2] text-white rounded text-sm hover:bg-[#005a7a] mr-2"
                              >
                                View Details
                              </button>
                              <button
                                onClick={() => deleteDuplicates(dup.invoiceNumber)}
                                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                              >
                                Delete Duplicates
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Duplicate Details */}
                  {selectedDuplicate && duplicateDetails.length > 0 && (
                    <div className="mt-6 p-4 bg-gray-50 rounded">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg">
                          All Instances of "{selectedDuplicate}"
                        </h3>
                        <button
                          onClick={() => {
                            setSelectedDuplicate(null);
                            setDuplicateDetails([]);
                          }}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ✕ Close
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border rounded">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-2 text-left">Upload Date</th>
                              <th className="px-4 py-2 text-left">Invoice Date</th>
                              <th className="px-4 py-2 text-left">Due Date</th>
                              <th className="px-4 py-2 text-left">Client</th>
                              <th className="px-4 py-2 text-left">Amount</th>
                              <th className="px-4 py-2 text-left">Status</th>
                              <th className="px-4 py-2 text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {duplicateDetails.map((inv, idx) => (
                              <tr key={inv.id} className={`border-t ${idx === 0 ? 'bg-green-50' : ''}`}>
                                <td className="px-4 py-2 text-sm">
                                  {formatDate(inv.uploadDate)}
                                  {idx === 0 && <span className="ml-2 text-xs text-green-600 font-bold">(Most Recent)</span>}
                                </td>
                                <td className="px-4 py-2 text-sm">{formatDate(inv.invoiceDate)}</td>
                                <td className="px-4 py-2 text-sm">{formatDate(inv.dueDate)}</td>
                                <td className="px-4 py-2">{inv.client}</td>
                                <td className="px-4 py-2">
                                  <div className="font-semibold">${convertToUSD(inv.amountDue, inv.currency).toLocaleString()} USD</div>
                                  <div className="text-xs text-gray-600">
                                    ${Math.round(inv.amountDue).toLocaleString()} {inv.currency}
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <span
                                    className="px-2 py-1 rounded text-white text-xs"
                                    style={{ backgroundColor: STATUS_COLORS[inv.status] || '#6B7280' }}
                                  >
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="px-4 py-2">
                                  <button
                                    onClick={() => startEditInvoice(inv)}
                                    className="px-3 py-1 bg-[#0076A2] text-white rounded text-sm hover:bg-[#005a7a]"
                                  >
                                    View/Edit
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-[#707CF1] p-6 rounded-lg shadow mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Filters</h2>
              <button
                onClick={() => setFiltersCollapsed(!filtersCollapsed)}
                className="px-3 py-1 bg-[#151744] text-white rounded hover:bg-[#0d0e2a] transition text-sm flex items-center gap-1"
                title={filtersCollapsed ? "Expand Filters" : "Collapse Filters"}
              >
                {filtersCollapsed ? (
                  <>
                    <span>▼</span>
                    <span>Show</span>
                  </>
                ) : (
                  <>
                    <span>▲</span>
                    <span>Hide</span>
                  </>
                )}
              </button>
            </div>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-[#151744] text-white rounded hover:bg-[#0d0e2a] transition"
            >
              Clear All Filters
            </button>
          </div>

          {!filtersCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Status {statusFilter.length > 0 && `(${statusFilter.length} selected)`}
              </label>
              <div className="bg-white border rounded px-3 py-2 space-y-1">
                {[
                  { value: 'Paid', label: '✓ Paid' },
                  { value: 'Pending', label: '⏳ Unpaid (All)' },
                  { value: 'Current Unpaid', label: '📅 Current Unpaid (Not Yet Due)' },
                  { value: 'Due This Month', label: '📆 Due This Month' },
                  { value: 'Overdue', label: '⚠️ Overdue (Past Due Date)' }
                ].map(status => (
                  <label key={status.value} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={statusFilter.includes(status.value)}
                      onChange={() => {
                        toggleStatus(status.value);
                        setActiveStatBox(null);
                      }}
                      className="w-4 h-4 text-purple-600 cursor-pointer"
                    />
                    <span className="text-sm">{status.label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Type {typeFilter.length > 0 && `(${typeFilter.length} selected)`}
              </label>
              <div className="bg-white border rounded px-3 py-2 space-y-1 max-h-60 overflow-y-auto">
                {['PS', 'Maint', 'Sub', 'Hosting', 'MS', 'SW', 'HW', '3PP', 'Credit Memo'].map(type => (
                  <label key={type} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={typeFilter.includes(type)}
                      onChange={() => {
                        toggleType(type);
                        setActiveStatBox(null);
                      }}
                      className="w-4 h-4 text-purple-600 cursor-pointer"
                    />
                    <span className="text-sm">{type}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-white">Client</label>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="All">All</option>
                {clients.map(client => (
                  <option key={client} value={client}>{client}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-white">Contract</label>
              <select
                value={contractFilter}
                onChange={(e) => setContractFilter(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="All">All</option>
                {contracts.map(contract => (
                  <option key={contract} value={contract}>{contract}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Frequency {frequencyFilter.length > 0 && `(${frequencyFilter.length} selected)`}
              </label>
              <div className="bg-white border rounded px-3 py-2 space-y-1">
                {['adhoc', 'monthly', 'quarterly', 'tri-annual', 'bi-annual', 'annual'].map(freq => (
                  <label key={freq} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={frequencyFilter.includes(freq)}
                      onChange={() => toggleFrequency(freq)}
                      className="w-4 h-4 text-purple-600 cursor-pointer"
                    />
                    <span className="text-sm capitalize">
                      {freq === 'adhoc' ? 'Ad-hoc' : freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-white">Due Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-white">Due Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1 text-white">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search invoice #, client, contract, description..."
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          )}
        </div>

        {/* Grouping */}
        <div className="bg-[#707CF1] p-6 rounded-lg shadow mb-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-white">Grouping</h2>
            <button
              onClick={() => setGroupingCollapsed(!groupingCollapsed)}
              className="px-3 py-1 bg-[#151744] text-white rounded hover:bg-[#0d0e2a] transition text-sm flex items-center gap-1"
              title={groupingCollapsed ? "Expand Grouping" : "Collapse Grouping"}
            >
              {groupingCollapsed ? (
                <>
                  <span>▼</span>
                  <span>Show</span>
                </>
              ) : (
                <>
                  <span>▲</span>
                  <span>Hide</span>
                </>
              )}
            </button>
          </div>

          {!groupingCollapsed && (
            <div className="flex gap-4 items-center flex-wrap">
            <div>
              <label className="block text-sm font-medium mb-1 text-white">Group By</label>
              <select 
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="None">None</option>
                <option value="Client">Client</option>
                <option value="Contract">Contract</option>
                <option value="Status">Status</option>
                <option value="Type">Type</option>
              </select>
            </div>
            
            {groupBy !== 'None' && (
              <div>
                <label className="block text-sm font-medium mb-1 text-white">Then By</label>
                <select 
                  value={secondaryGroupBy}
                  onChange={(e) => setSecondaryGroupBy(e.target.value)}
                  className="border rounded px-3 py-2"
                >
                  <option value="None">None</option>
                  <option value="Client">Client</option>
                  <option value="Contract">Contract</option>
                  <option value="Status">Status</option>
                  <option value="Type">Type</option>
                </select>
              </div>
            )}
            
            {groupBy !== 'None' && (
              <>
                <button
                  onClick={() => {
                    const newExpanded = {};
                    Object.keys(groupedInvoices).forEach(key => {
                      newExpanded[key] = true;
                    });
                    setExpandedGroups(newExpanded);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  Expand All
                </button>
                
                <button
                  onClick={() => setExpandedGroups({})}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                >
                  Collapse All
                </button>
              </>
            )}
          </div>
          )}
        </div>

        {/* Invoice Table */}
        <div className="bg-white rounded-lg shadow">
          <button
            onClick={() => setShowInvoiceTable(!showInvoiceTable)}
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg">
                Invoices ({filteredInvoices.length})
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInvoiceTable(!showInvoiceTable);
                }}
                className="px-3 py-1 bg-[#707CF1] text-white rounded hover:bg-[#5a6ad9] transition text-sm flex items-center gap-1"
                title={showInvoiceTable ? "Collapse Invoices" : "Expand Invoices"}
              >
                {showInvoiceTable ? (
                  <>
                    <span>▲</span>
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <span>▼</span>
                    <span>Show</span>
                  </>
                )}
              </button>
            </div>
          </button>
          
          {showInvoiceTable && (
            <div className="px-6 pb-6">
              {Object.keys(groupedInvoices).map(groupName => {
                const groupInvs = groupedInvoices[groupName];
                const groupTotal = groupInvs.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);
                // Always show invoices when no grouping, otherwise use collapsed by default
                const isExpanded = groupBy === 'None' ? true : expandedGroups[groupName] === true;
                
                // Extract contract from group name if grouping by contract
                const isContractGroup = groupBy === 'Contract' && groupName !== 'Uncategorized';
                const contractName = isContractGroup ? groupName.split(' > ')[0] : null;
                const contractInfo = contractName ? contractValues[contractName] : null;
                const contractValueUSD = contractInfo ? convertToUSD(contractInfo.value, contractInfo.currency) : 0;
                const totalPaid = groupInvs.filter(inv => inv.status === 'Paid').reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);
                const remaining = contractValueUSD - groupTotal;
                const percentage = contractValueUSD > 0 ? Math.round((groupTotal / contractValueUSD) * 100) : 0;
                
                return (
                  <div key={groupName} className="mb-4">
                    {groupBy !== 'None' && (
                      <div className="bg-gray-100 px-4 py-3 rounded">
                        <div
                          onClick={() => setExpandedGroups({
                            ...expandedGroups,
                            [groupName]: !isExpanded
                          })}
                          className="cursor-pointer hover:bg-gray-200 transition flex justify-between items-center p-2 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold select-none">{isExpanded ? '▼' : '▶'}</span>
                            <span className="font-bold text-gray-900">{groupName}</span>
                            <span className="text-sm text-gray-600">({groupInvs.length} invoices)</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-blue-600">
                              ${groupTotal.toLocaleString()} USD
                            </span>
                          </div>
                        </div>
                        
                        {/* Contract Value Management */}
                        {isContractGroup && isExpanded && (
                          <div className="mt-3 pt-3 border-t border-gray-300">
                            <div className="flex gap-4 items-center mb-3">
                              <div className="flex gap-2 items-center">
                                <label className="text-sm font-medium">Contract Value:</label>
                                <input
                                  type="number"
                                  placeholder="Enter amount"
                                  value={contractInfo?.value || ''}
                                  onChange={(e) => saveContractValue(contractName, e.target.value, contractInfo?.currency || 'USD')}
                                  className="border rounded px-3 py-1 w-32"
                                />
                                <select
                                  value={contractInfo?.currency || 'USD'}
                                  onChange={(e) => saveContractValue(contractName, contractInfo?.value || 0, e.target.value)}
                                  className="border rounded px-2 py-1"
                                >
                                  <option value="USD">USD</option>
                                  <option value="AUD">AUD</option>
                                  <option value="EUR">EUR</option>
                                  <option value="GBP">GBP</option>
                                  <option value="SGD">SGD</option>
                                </select>
                              </div>
                            </div>
                            
                            {contractValueUSD > 0 && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Total Invoiced:</span>
                                  <span className="font-bold">${groupTotal.toLocaleString()} USD</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Amount Paid:</span>
                                  <span className="font-bold text-green-600">${totalPaid.toLocaleString()} USD</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Remaining Balance:</span>
                                  <span className="font-bold text-orange-600">${remaining.toLocaleString()} USD</span>
                                </div>
                                <div className="mt-2">
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>Contract Progress:</span>
                                    <span className="font-bold">{percentage}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-4">
                                    <div 
                                      className="bg-blue-600 h-4 rounded-full transition-all"
                                      style={{ width: `${Math.min(percentage, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isExpanded && (
                      <div className="overflow-x-auto mt-2">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left">Invoice #</th>
                              <th className="px-4 py-2 text-left">Client</th>
                              <th className="px-4 py-2 text-left">Contract</th>
                              <th className="px-4 py-2 text-left">PO Number</th>
                              <th className="px-4 py-2 text-left">Type</th>
                              <th className="px-4 py-2 text-left">Date</th>
                              <th className="px-4 py-2 text-left">Due Date</th>
                              <th className="px-4 py-2 text-left">Amount</th>
                              <th className="px-4 py-2 text-left">Status</th>
                              <th className="px-4 py-2 text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupInvs.map(inv => (
                              <tr key={inv.id} className="border-t hover:bg-gray-50">
                                <td className="px-4 py-2">
                                  <button
                                    onClick={() => setSelectedInvoice(inv)}
                                    className="text-blue-600 hover:underline font-semibold"
                                  >
                                    {inv.invoiceNumber}
                                  </button>
                                </td>
                                <td className="px-4 py-2 text-gray-900">{inv.client}</td>
                                <td className="px-4 py-2 text-gray-900">{inv.customerContract || '-'}</td>
                                <td className="px-4 py-2 text-gray-900">{inv.poNumber || '-'}</td>
                                <td className="px-4 py-2">
                                  <span
                                    className="px-2 py-1 rounded text-white text-xs inline-block text-center min-w-[85px] whitespace-nowrap"
                                    style={{ backgroundColor: TYPE_COLORS[inv.invoiceType] || '#6B7280' }}
                                  >
                                    {inv.invoiceType}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{formatDate(inv.invoiceDate)}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{formatDate(inv.dueDate)}</td>
                                <td className="px-4 py-2">
                                  <div className="font-semibold text-gray-900">${convertToUSD(inv.amountDue, inv.currency).toLocaleString()} USD</div>
                                  <div className="text-xs text-gray-600">
                                    ${Math.round(inv.amountDue).toLocaleString()} {inv.currency}
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  {inv.invoiceType === 'Credit Memo' ? (
                                    <span className="text-gray-400 text-sm">N/A</span>
                                  ) : (
                                    <span
                                      className="px-2 py-1 rounded text-white text-xs"
                                      style={{ backgroundColor: STATUS_COLORS[inv.status] || '#6B7280' }}
                                    >
                                      {inv.status}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  {inv.invoiceType === 'Credit Memo' ? (
                                    <span className="text-gray-400 text-sm">N/A</span>
                                  ) : inv.status === 'Paid' ? (
                                    <button
                                      onClick={() => updateInvoiceStatus(inv.id, 'Pending')}
                                      className="px-3 py-1 bg-[#0076A2] text-white rounded text-sm hover:bg-[#005a7a]"
                                    >
                                      Mark Unpaid
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => updateInvoiceStatus(inv.id, 'Paid')}
                                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                                    >
                                      Mark Paid
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Invoice Detail Modal */}
        {selectedInvoice && !editingInvoice && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4"
            onClick={() => setSelectedInvoice(null)}
          >
            <div 
              className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Invoice Details</h2>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-600">Invoice Number</div>
                    <div className="font-bold">{selectedInvoice.invoiceNumber}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Client</div>
                    <div className="font-bold">{selectedInvoice.client}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Invoice Date</div>
                    <div>{formatDate(selectedInvoice.invoiceDate)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Due Date</div>
                    <div>{formatDate(selectedInvoice.dueDate)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Amount</div>
                    <div className="font-bold">
                      ${Math.round(selectedInvoice.amountDue).toLocaleString()} {selectedInvoice.currency}
                      <div className="text-sm text-gray-500">
                        ${convertToUSD(selectedInvoice.amountDue, selectedInvoice.currency).toLocaleString()} USD
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Status</div>
                    <span 
                      className="inline-block px-2 py-1 rounded text-white text-xs"
                      style={{ backgroundColor: STATUS_COLORS[selectedInvoice.status] }}
                    >
                      {selectedInvoice.status}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Type</div>
                    <span
                      className="inline-block px-2 py-1 rounded text-white text-xs"
                      style={{ backgroundColor: TYPE_COLORS[selectedInvoice.invoiceType] }}
                    >
                      {displayInvoiceType(selectedInvoice.invoiceType)}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Frequency</div>
                    <div className="capitalize">{selectedInvoice.frequency}</div>
                  </div>
                  {selectedInvoice.customerContract && (
                    <div>
                      <div className="text-sm text-gray-600">Contract</div>
                      <div>{selectedInvoice.customerContract}</div>
                      {contractValues[selectedInvoice.customerContract] && (
                        <div className="text-xs text-gray-500 mt-1">
                          Contract Value: ${Math.round(contractValues[selectedInvoice.customerContract].value).toLocaleString()} {contractValues[selectedInvoice.customerContract].currency}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedInvoice.poNumber && (
                    <div>
                      <div className="text-sm text-gray-600">PO Number</div>
                      <div>{selectedInvoice.poNumber}</div>
                    </div>
                  )}
                </div>
                
                {selectedInvoice.services && (
                  <div>
                    <div className="text-sm text-gray-600">Services</div>
                    <div className="text-sm">{selectedInvoice.services}</div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex gap-2 flex-wrap">
                {selectedInvoice.pdfPath && (
                  <a
                    href={`http://localhost:3001${selectedInvoice.pdfPath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    View PDF
                  </a>
                )}
                
                <button
                  onClick={() => startEditInvoice(selectedInvoice)}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
                >
                  Edit Invoice
                </button>
                
                {selectedInvoice.status === 'Paid' ? (
                  <button
                    onClick={() => {
                      updateInvoiceStatus(selectedInvoice.id, 'Pending');
                      setSelectedInvoice(null);
                    }}
                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition"
                  >
                    Mark as Unpaid
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      updateInvoiceStatus(selectedInvoice.id, 'Paid');
                      setSelectedInvoice(null);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                  >
                    Mark as Paid
                  </button>
                )}
                
                <button
                  onClick={() => {
                    deleteInvoice(selectedInvoice.id);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                  Delete Invoice
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Invoice Modal */}
        {editingInvoice && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4"
            onClick={() => setEditingInvoice(null)}
          >
            <div 
              className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Edit Invoice</h2>
                <button
                  onClick={() => setEditingInvoice(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Invoice Number</label>
                    <input
                      type="text"
                      value={editForm.invoiceNumber}
                      onChange={(e) => setEditForm({...editForm, invoiceNumber: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Client</label>
                    <input
                      type="text"
                      value={editForm.client}
                      onChange={(e) => setEditForm({...editForm, client: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Contract Number</label>
                    <input
                      type="text"
                      value={editForm.customerContract}
                      onChange={(e) => setEditForm({...editForm, customerContract: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">PO Number</label>
                    <input
                      type="text"
                      value={editForm.poNumber}
                      onChange={(e) => setEditForm({...editForm, poNumber: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                      value={editForm.invoiceType}
                      onChange={(e) => setEditForm({...editForm, invoiceType: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="PS">PS</option>
                      <option value="Maint">Maint</option>
                      <option value="Sub">Sub</option>
                      <option value="Hosting">Hosting</option>
                      <option value="MS">MS</option>
                      <option value="SW">SW</option>
                      <option value="HW">HW</option>
                      <option value="3PP">3PP</option>
                      <option value="Credit Memo">Credit Memo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Currency</label>
                    <select
                      value={editForm.currency}
                      onChange={(e) => setEditForm({...editForm, currency: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="USD">USD</option>
                      <option value="AUD">AUD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="SGD">SGD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Frequency</label>
                    <select
                      value={editForm.frequency}
                      onChange={(e) => setEditForm({...editForm, frequency: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="adhoc">Ad Hoc</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="tri-annual">Tri-Annual</option>
                      <option value="bi-annual">Bi-Annual</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Amount</label>
                    <input
                      type="number"
                      value={editForm.amountDue}
                      onChange={(e) => setEditForm({...editForm, amountDue: parseFloat(e.target.value)})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Invoice Date</label>
                    <input
                      type="date"
                      value={editForm.invoiceDate}
                      onChange={(e) => setEditForm({...editForm, invoiceDate: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Due Date</label>
                    <input
                      type="date"
                      value={editForm.dueDate}
                      onChange={(e) => setEditForm({...editForm, dueDate: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Services</label>
                  <textarea
                    value={editForm.services}
                    onChange={(e) => setEditForm({...editForm, services: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    rows="4"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex gap-2 justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={saveEditInvoice}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingInvoice(null)}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
                <div className="flex gap-2">
                  {editingInvoice.pdfPath && (
                    <button
                      onClick={() => window.open(`http://localhost:3001${editingInvoice.pdfPath}`, '_blank')}
                      className="px-4 py-2 bg-[#0076A2] text-white rounded hover:bg-[#005a7a] transition"
                    >
                      View PDF
                    </button>
                  )}
                  <button
                    onClick={() => deleteInvoice(editingInvoice.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                  >
                    Delete Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <div className="text-xl font-bold">Processing...</div>
          </div>
        </div>
      )}
    </div>
  );
}

// App wrapper component to manage navigation between views
function App() {
  const [currentView, setCurrentView] = useState('tracker'); // 'tracker' or 'analytics'

  return (
    <>
      {currentView === 'tracker' ? (
        <InvoiceTracker
          onNavigateToAnalytics={() => setCurrentView('analytics')}
        />
      ) : (
        <Analytics
          onNavigateBack={() => setCurrentView('tracker')}
        />
      )}
    </>
  );
}

export default App;
