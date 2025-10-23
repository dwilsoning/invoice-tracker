import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

// Type colors
const TYPE_COLORS = {
  'PS': '#3B82F6',
  'Maint': '#10B981',
  'Sub': '#8B5CF6',
  'Hosting': '#F59E0B',
  'MS': '#EF4444',
  'HW': '#6366F1',
  '3PP': '#EC4899',
  'Credit Memo': '#DC2626'  // Red color for credit memos
};

// Status colors
const STATUS_COLORS = {
  'Paid': '#10B981',
  'Pending': '#F59E0B',
  'Overdue': '#EF4444'
};

function InvoiceTracker() {
  const [invoices, setInvoices] = useState([]);
  const [expectedInvoices, setExpectedInvoices] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({});
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [clientFilter, setClientFilter] = useState('All');
  const [contractFilter, setContractFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [agingFilter, setAgingFilter] = useState('All');

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
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [queryText, setQueryText] = useState('');
  const [queryResult, setQueryResult] = useState(null);

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

  // Load data
  useEffect(() => {
    loadInvoices();
    loadExpectedInvoices();
    loadExchangeRates();
    loadContracts();
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
    const date = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2); // 2-digit year
    return `${day}-${month}-${year}`;
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
          showMessage('warning', `Duplicates skipped: ${dupList}`);
        }
        
        showMessage('success', `Uploaded ${response.data.invoices.length} invoices`);
        await loadInvoices();
        await loadExpectedInvoices();
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

  // Filter invoices
  const getFilteredInvoices = () => {
    let filtered = [...invoices];

    // Status filter
    if (statusFilter !== 'All') {
      const today = new Date().toISOString().split('T')[0];

      if (statusFilter === 'Overdue') {
        filtered = filtered.filter(inv => inv.status === 'Pending' && inv.dueDate < today);
      } else if (statusFilter === 'Current Unpaid') {
        filtered = filtered.filter(inv => inv.status === 'Pending' && inv.dueDate >= today);
      } else {
        filtered = filtered.filter(inv => inv.status === statusFilter);
      }
    }

    // Aging filter
    if (agingFilter !== 'All') {
      filtered = filtered.filter(inv => {
        const bucket = getAgingBucket(inv);
        return bucket === agingFilter;
      });
    }

    // Type filter
    if (typeFilter !== 'All') {
      filtered = filtered.filter(inv => inv.invoiceType === typeFilter);
    }

    // Client filter
    if (clientFilter !== 'All') {
      filtered = filtered.filter(inv => inv.client === clientFilter);
    }

    // Contract filter
    if (contractFilter !== 'All') {
      filtered = filtered.filter(inv => inv.customerContract === contractFilter);
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(inv => inv.invoiceDate >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter(inv => inv.invoiceDate <= dateTo);
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

    const dueThisMonth = regularInvoices.filter(inv => inv.status === 'Pending' && inv.dueDate && inv.dueDate.startsWith(thisMonth)).reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);

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
      totalCreditMemos,
      creditMemosCount
    };
  };

  // Group invoices
  const groupInvoices = (invoicesToGroup) => {
    if (groupBy === 'None') return { 'All Invoices': invoicesToGroup };
    
    const grouped = {};
    
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
      if (bucket && buckets[bucket]) {
        buckets[bucket].count++;
        buckets[bucket].total += convertToUSD(inv.amountDue, inv.currency);
        buckets[bucket].invoices.push(inv);
      }
    });

    return buckets;
  };

  // Clear filters
  const clearFilters = () => {
    setStatusFilter('All');
    setTypeFilter('All');
    setClientFilter('All');
    setContractFilter('All');
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setAgingFilter('All');
  };

  // Handle stat click
  const handleStatClick = (statType) => {
    clearFilters();
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    switch (statType) {
      case 'paid':
        setStatusFilter('Paid');
        break;
      case 'unpaid':
        setStatusFilter('Pending');
        break;
      case 'overdue':
        setStatusFilter('Overdue');
        break;
      case 'currentUnpaid':
        setStatusFilter('Current Unpaid');
        break;
      case 'dueThisMonth':
        setStatusFilter('Pending');
        setDateFrom(thisMonth + '-01');
        setDateTo(thisMonth + '-31');
        break;
    }
  };

  // Handle aging bucket click
  const handleAgingClick = (bucket) => {
    clearFilters();
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
      setSelectedInvoice(null);
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
      services: invoice.services || ''
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

  // Natural language query
  const handleQuery = async () => {
    if (!queryText.trim()) return;
    
    try {
      const response = await axios.post(`${API_URL}/query`, { query: queryText });
      setQueryResult(response.data);
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

  const unacknowledgedExpected = expectedInvoices.filter(e => !e.acknowledged);
  const acknowledgedExpected = expectedInvoices.filter(e => e.acknowledged);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" onDragOver={handleDragOver}>
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

      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Invoice Tracker</h1>

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
          <label className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition">
            Upload PDFs
            <input
              type="file"
              multiple
              accept=".pdf"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </label>

          <label className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition">
            Upload Payment Sheet
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </label>

          <button
            onClick={deleteAllInvoices}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition border-2 border-red-800"
          >
            🗑️ Delete All Invoices (DEV)
          </button>
        </div>

        {/* Dashboard date filter */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="flex gap-4 items-center flex-wrap">
            <label className="font-semibold">Dashboard Period:</label>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div
            className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition"
            onClick={() => {}}
          >
            <div className="text-gray-600 text-sm">Total Invoiced</div>
            <div className="text-3xl font-bold text-gray-900">${stats.totalInvoiced.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">All invoices in selected period</div>
          </div>

          <div
            className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition"
            onClick={() => handleStatClick('paid')}
          >
            <div className="text-gray-600 text-sm">Total Paid</div>
            <div className="text-3xl font-bold text-green-600">${stats.totalPaid.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Invoices marked as paid</div>
          </div>

          <div
            className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition"
            onClick={() => handleStatClick('unpaid')}
          >
            <div className="text-gray-600 text-sm flex items-center gap-1">
              Total Unpaid
              <span className="text-xs text-gray-400" title="All invoices not yet paid, including those not yet due">ⓘ</span>
            </div>
            <div className="text-3xl font-bold text-yellow-600">${stats.totalUnpaid.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">All pending invoices ({stats.unpaidCount})</div>
          </div>

          <div
            className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition"
            onClick={() => handleStatClick('overdue')}
          >
            <div className="text-gray-600 text-sm flex items-center gap-1">
              Overdue
              <span className="text-xs text-gray-400" title="Unpaid invoices past their due date">ⓘ</span>
            </div>
            <div className="text-3xl font-bold text-red-600">${stats.overdueAmount.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Past due date ({stats.overdueCount} invoices)</div>
          </div>

          <div
            className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition"
            onClick={() => handleStatClick('currentUnpaid')}
          >
            <div className="text-gray-600 text-sm flex items-center gap-1">
              Current Unpaid
              <span className="text-xs text-gray-400" title="Unpaid invoices not yet overdue">ⓘ</span>
            </div>
            <div className="text-3xl font-bold text-orange-600">${stats.currentUnpaid.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Not yet due ({stats.currentUnpaidCount} invoices)</div>
          </div>

          <div
            className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition"
            onClick={() => handleStatClick('dueThisMonth')}
          >
            <div className="text-gray-600 text-sm">Due This Month</div>
            <div className="text-3xl font-bold text-blue-600">${stats.dueThisMonth.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Unpaid, due in current month</div>
          </div>

          <div
            className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition"
            onClick={() => {
              setStatusFilter('All');
              setTypeFilter('Credit Memo');
              setClientFilter('All');
              setContractFilter('All');
              setAgingFilter('All');
              setSearchTerm('');
              setShowInvoiceTable(true);
            }}
          >
            <div className="text-gray-600 text-sm flex items-center gap-1">
              Total Credit Memos
              <span className="text-xs text-gray-400" title="Credit memos issued (negative amounts)">ⓘ</span>
            </div>
            <div className="text-3xl font-bold text-red-600">${Math.abs(stats.totalCreditMemos).toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-1">Credits issued ({stats.creditMemosCount} memos)</div>
          </div>
        </div>

        {/* Aged Invoice Report */}
        <div className="mb-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Aged Invoice Report (Unpaid Only)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {Object.keys(agingStats).map(bucket => {
              const data = agingStats[bucket];
              const isActive = agingFilter === bucket;

              // Color scheme based on aging severity
              const getColor = () => {
                if (bucket === 'Current') return 'bg-green-100 hover:bg-green-200 border-green-300 text-green-800';
                if (bucket === '31-60') return 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300 text-yellow-800';
                if (bucket === '61-90') return 'bg-orange-100 hover:bg-orange-200 border-orange-300 text-orange-800';
                if (bucket === '91-120') return 'bg-red-100 hover:bg-red-200 border-red-300 text-red-800';
                if (bucket === '121-180') return 'bg-red-200 hover:bg-red-300 border-red-400 text-red-900';
                if (bucket === '181-270') return 'bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-800';
                if (bucket === '271-365') return 'bg-purple-200 hover:bg-purple-300 border-purple-400 text-purple-900';
                return 'bg-gray-200 hover:bg-gray-300 border-gray-400 text-gray-900';
              };

              const activeClass = isActive ? 'ring-4 ring-blue-500' : '';

              return (
                <div
                  key={bucket}
                  onClick={() => handleAgingClick(bucket)}
                  className={`${getColor()} ${activeClass} p-4 rounded-lg border-2 cursor-pointer transition-all transform hover:scale-105`}
                >
                  <div className="text-xs font-semibold mb-1">
                    {bucket === 'Current' ? 'Current' : `${bucket} days`}
                  </div>
                  <div className="text-2xl font-bold mb-1">
                    ${data.total.toLocaleString()}
                  </div>
                  <div className="text-xs opacity-75">
                    {data.count} invoice{data.count !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 text-xs text-gray-600">
            Click on any aging bucket to filter invoices. Current = not yet due or up to 30 days overdue.
          </div>
        </div>

        {/* Natural Language Query */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-3">Ask About Your Invoices</h2>
          <div className="flex gap-2">
            <input 
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleQuery()}
              placeholder="E.g., 'What's the total for PS invoices from Acme Corp?'"
              className="flex-1 border rounded px-4 py-2"
            />
            <button 
              onClick={handleQuery}
              className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
            >
              Ask
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
          <div className="bg-white rounded-lg shadow mb-2">
            <button
              onClick={() => setShowExpectedUnack(!showExpectedUnack)}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition"
            >
              <span className="font-bold text-lg">
                Expected Invoices - Unacknowledged ({unacknowledgedExpected.length})
              </span>
              <span>{showExpectedUnack ? '−' : '+'}</span>
            </button>
            
            {showExpectedUnack && unacknowledgedExpected.length > 0 && (
              <div className="px-6 pb-4">
                <div className="overflow-x-auto">
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
                        <tr key={exp.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2">{exp.client}</td>
                          <td className="px-4 py-2">{exp.customerContract || '-'}</td>
                          <td className="px-4 py-2">
                            <span 
                              className="px-2 py-1 rounded text-white text-xs"
                              style={{ backgroundColor: TYPE_COLORS[exp.invoiceType] || '#6B7280' }}
                            >
                              {exp.invoiceType}
                            </span>
                          </td>
                          <td className="px-4 py-2">{formatDate(exp.expectedDate)}</td>
                          <td className="px-4 py-2">
                            ${Math.round(exp.expectedAmount).toLocaleString()} {exp.currency}
                          </td>
                          <td className="px-4 py-2 capitalize">{exp.frequency}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => acknowledgeExpected(exp.id, true)}
                              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 mr-2"
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
          <div className="bg-white rounded-lg shadow">
            <button
              onClick={() => setShowExpectedAck(!showExpectedAck)}
              className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition"
            >
              <span className="font-bold text-lg">
                Expected Invoices - Acknowledged ({acknowledgedExpected.length})
              </span>
              <span>{showExpectedAck ? '−' : '+'}</span>
            </button>
            
            {showExpectedAck && acknowledgedExpected.length > 0 && (
              <div className="px-6 pb-4">
                <div className="overflow-x-auto">
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
                        <tr key={exp.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2">{exp.client}</td>
                          <td className="px-4 py-2">{exp.customerContract || '-'}</td>
                          <td className="px-4 py-2">
                            <span 
                              className="px-2 py-1 rounded text-white text-xs"
                              style={{ backgroundColor: TYPE_COLORS[exp.invoiceType] || '#6B7280' }}
                            >
                              {exp.invoiceType}
                            </span>
                          </td>
                          <td className="px-4 py-2">{formatDate(exp.expectedDate)}</td>
                          <td className="px-4 py-2">
                            ${Math.round(exp.expectedAmount).toLocaleString()} {exp.currency}
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => acknowledgeExpected(exp.id, false)}
                              className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 mr-2"
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

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Filters</h2>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
            >
              Clear All Filters
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">✓ Paid</option>
                <option value="Pending">⏳ Unpaid (All)</option>
                <option value="Current Unpaid">📅 Current Unpaid (Not Yet Due)</option>
                <option value="Overdue">⚠️ Overdue (Past Due Date)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="All">All</option>
                <option value="PS">PS</option>
                <option value="Maint">Maint</option>
                <option value="Sub">Sub</option>
                <option value="Hosting">Hosting</option>
                <option value="MS">MS</option>
                <option value="HW">HW</option>
                <option value="3PP">3PP</option>
                <option value="Credit Memo">Credit Memo</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Client</label>
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
              <label className="block text-sm font-medium mb-1">Contract</label>
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
              <label className="block text-sm font-medium mb-1">From Date</label>
              <input 
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">To Date</label>
              <input 
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            
            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-1">Search</label>
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search invoice #, client, contract, description..."
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
        </div>

        {/* Grouping */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-bold mb-4">Grouping</h2>
          <div className="flex gap-4 items-center flex-wrap">
            <div>
              <label className="block text-sm font-medium mb-1">Group By</label>
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
                <label className="block text-sm font-medium mb-1">Then By</label>
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
        </div>

        {/* Invoice Table */}
        <div className="bg-white rounded-lg shadow">
          <button
            onClick={() => setShowInvoiceTable(!showInvoiceTable)}
            className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition"
          >
            <span className="font-bold text-lg">
              Invoices ({filteredInvoices.length})
            </span>
            <span>{showInvoiceTable ? '−' : '+'}</span>
          </button>
          
          {showInvoiceTable && (
            <div className="px-6 pb-6">
              {Object.keys(groupedInvoices).map(groupName => {
                const groupInvs = groupedInvoices[groupName];
                const groupTotal = groupInvs.reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);
                const isExpanded = expandedGroups[groupName] !== false;
                
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
                          className="cursor-pointer hover:bg-gray-200 transition flex justify-between items-center"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{groupName}</span>
                            <span className="text-sm text-gray-600">({groupInvs.length} invoices)</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-blue-600">
                              ${groupTotal.toLocaleString()} USD
                            </span>
                            <span>{isExpanded ? '−' : '+'}</span>
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
                                    className="text-blue-600 hover:underline"
                                  >
                                    {inv.invoiceNumber}
                                  </button>
                                </td>
                                <td className="px-4 py-2">{inv.client}</td>
                                <td className="px-4 py-2">{inv.customerContract || '-'}</td>
                                <td className="px-4 py-2">{inv.poNumber || '-'}</td>
                                <td className="px-4 py-2">
                                  <span 
                                    className="px-2 py-1 rounded text-white text-xs"
                                    style={{ backgroundColor: TYPE_COLORS[inv.invoiceType] || '#6B7280' }}
                                  >
                                    {inv.invoiceType}
                                  </span>
                                </td>
                                <td className="px-4 py-2">{formatDate(inv.invoiceDate)}</td>
                                <td className="px-4 py-2">{formatDate(inv.dueDate)}</td>
                                <td className="px-4 py-2">
                                  <div>${Math.round(inv.amountDue).toLocaleString()} {inv.currency}</div>
                                  <div className="text-xs text-gray-500">
                                    ${convertToUSD(inv.amountDue, inv.currency).toLocaleString()} USD
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
                                  {inv.status === 'Paid' ? (
                                    <button
                                      onClick={() => updateInvoiceStatus(inv.id, 'Pending')}
                                      className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
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
                      {selectedInvoice.invoiceType}
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
              
              <div className="mt-6 flex gap-2">
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

export default InvoiceTracker;
