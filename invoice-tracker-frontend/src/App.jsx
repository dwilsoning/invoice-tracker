import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Analytics from './Analytics';
import { useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Header from './components/Header';
import Chatbot from './components/Chatbot';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  'Credit Memo': '#DC2626',  // Red color for credit memos
  'Vendor Invoice': '#8B5CF6',  // Purple for vendor invoices
  'Purchase Order': '#14B8A6'  // Teal for purchase orders
};

// Helper function to display invoice type
const displayInvoiceType = (type) => {
  return type === 'Credit Memo' ? 'CM' : type;
};

// Helper function to check if invoice type should be excluded from calculations
const isExcludedFromCalculations = (invoiceType) => {
  return ['Credit Memo', 'Vendor Invoice', 'Purchase Order'].includes(invoiceType);
};

// Status colors
const STATUS_COLORS = {
  'Paid': '#10B981',
  'Pending': '#0076A2',
  'Overdue': '#EF4444'
};

function InvoiceTracker({ onNavigateToAnalytics, isAdmin }) {
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
  const [clientFilter, setClientFilter] = useState([]);
  const [contractFilter, setContractFilter] = useState('All');
  const [agingClientFilter, setAgingClientFilter] = useState([]); // Separate filter for Aged Invoice Report
  const [showContractsWithNoValue, setShowContractsWithNoValue] = useState(false);
  const [contractPercentageRangeMin, setContractPercentageRangeMin] = useState('');
  const [contractPercentageRangeMax, setContractPercentageRangeMax] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [agingClientSearchTerm, setAgingClientSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [agingFilter, setAgingFilter] = useState('All');
  const [activeStatBox, setActiveStatBox] = useState(null);
  const [selectedExpectedInvoiceId, setSelectedExpectedInvoiceId] = useState(null);

  // Dashboard date filter
  const [dashboardDateFilter, setDashboardDateFilter] = useState('currentYear');
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
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState(null); // For row highlighting (separate from modal)
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [quickEditInvoice, setQuickEditInvoice] = useState(null); // For quick notes/services modal
  const [quickEditNotes, setQuickEditNotes] = useState(''); // Temporary state for editing notes
  const [editForm, setEditForm] = useState({});
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [createForm, setCreateForm] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [checkingSAHealth, setCheckingSAHealth] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(true);

  // Sorting State
  const [sortBy, setSortBy] = useState('invoiceDate');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'

  // Duplicates State
  const [duplicates, setDuplicates] = useState([]);
  const [selectedDuplicate, setSelectedDuplicate] = useState(null);
  const [duplicateDetails, setDuplicateDetails] = useState([]);

  // Server Status
  const [serverStatus, setServerStatus] = useState('checking'); // 'online', 'offline', 'checking'

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);


  // Bulk Selection State
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);

  // Uploaded invoices filter
  const [showOnlyUploadedInvoices, setShowOnlyUploadedInvoices] = useState(false);
  const [uploadedInvoiceIds, setUploadedInvoiceIds] = useState([]);
  const [isUploadingInvoices, setIsUploadingInvoices] = useState(false);

  // Flash notification state
  const [flashNotification, setFlashNotification] = useState({ show: false, type: '' }); // 'success' or 'error'

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
    // Handle empty value - delete the contract or set to 0
    if (!value || value === '') {
      // Update UI to show empty
      const newValues = { ...contractValues };
      delete newValues[contract];
      setContractValues(newValues);

      try {
        // Delete the contract from database
        await axios.delete(`${API_URL}/contracts/${encodeURIComponent(contract)}`);
        showMessage('success', `Contract value cleared: ${contract}`);
      } catch (error) {
        console.error('Error deleting contract:', error);
        showMessage('error', 'Failed to clear contract value');
      }
      return;
    }

    // Don't save if value is invalid
    if (isNaN(parseFloat(value))) {
      return;
    }

    const numericValue = parseFloat(value);
    const newValues = {
      ...contractValues,
      [contract]: { value: numericValue, currency: currency || 'USD' }
    };
    setContractValues(newValues);

    try {
      const response = await axios.put(`${API_URL}/contracts/${encodeURIComponent(contract)}`, {
        contractValue: numericValue,
        currency: currency || 'USD'
      });

      if (response.data.success) {
        showMessage('success', `Contract value saved: ${contract}`);
      }
    } catch (error) {
      console.error('Error saving contract:', error);
      const errorMsg = error.response?.data?.error || 'Failed to save contract value';
      showMessage('error', errorMsg);

      // Reload contracts to get correct values
      await loadContracts();
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

  // Clear uploaded invoices filter when any other filter changes (but not during upload)
  useEffect(() => {
    if (showOnlyUploadedInvoices && !isUploadingInvoices) {
      setShowOnlyUploadedInvoices(false);
      setUploadedInvoiceIds([]);
    }
  }, [statusFilter, typeFilter, clientFilter, contractFilter,
      contractPercentageRangeMin, contractPercentageRangeMax, frequencyFilter, searchTerm,
      dateFrom, dateTo, agingFilter, activeStatBox, selectedExpectedInvoiceId, groupBy, secondaryGroupBy]);

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

  // Manual refresh all data
  const refreshAllData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadInvoices(),
        loadExpectedInvoices(),
        loadDuplicates(),
        loadContracts()
      ]);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error refreshing data:', error);
      showMessage('error', 'Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshAllData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

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

    // Trigger flash notification for success and error types
    if (type === 'success' || type === 'error') {
      setFlashNotification({ show: true, type });

      // Flash disappears after 2 seconds
      setTimeout(() => {
        setFlashNotification({ show: false, type: '' });
      }, 2000);
    }

    // For errors, message stays until user clicks it
    // For success/warning, auto-hide after 5 seconds
    if (type !== 'error') {
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    }
  };

  // Dismiss message (for clicking on error messages)
  const dismissMessage = () => {
    setMessage({ type: '', text: '' });
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

        // Get the IDs of newly uploaded invoices
        const uploadedIds = response.data.invoices.map(inv => inv.id);

        await loadInvoices();
        await loadExpectedInvoices();
        await loadDuplicates();

        // Set flag to prevent useEffect from clearing the uploaded filter during reset
        setIsUploadingInvoices(true);

        // Set filters to show only the newly uploaded invoices
        setStatusFilter([]);
        setTypeFilter([]);
        setClientFilter([]);
        setContractFilter('All');
        setContractPercentageRangeMin('');
        setContractPercentageRangeMax('');
        setFrequencyFilter([]);
        setSearchTerm('');
        setDateFrom('');
        setDateTo('');
        setAgingFilter('All');
        setActiveStatBox(null);
        setSelectedExpectedInvoiceId(null);
        setGroupBy('None');
        setSecondaryGroupBy('None');
        setExpandedGroups({});
        setUploadedInvoiceIds(uploadedIds);
        setShowOnlyUploadedInvoices(true);
        setShowInvoiceTable(true); // Show invoice table with uploaded invoices

        // Clear the upload flag after a brief delay to allow state updates to complete
        setTimeout(() => setIsUploadingInvoices(false), 100);
      }
      
      // Upload payment spreadsheet
      if (excelFiles.length > 0) {
        const excelFormData = new FormData();
        excelFiles.forEach(file => excelFormData.append('spreadsheet', file));

        const response = await axios.post(`${API_URL}/upload-payments`, excelFormData);
        const message = response.data.filesProcessed > 1
          ? `Updated ${response.data.updatedCount} invoice payments from ${response.data.filesProcessed} files`
          : `Updated ${response.data.updatedCount} invoice payments`;
        showMessage('success', message);

        // Get the IDs of updated invoices
        const updatedIds = response.data.updatedInvoiceIds || [];

        await loadInvoices();

        // If invoices were updated, show them in the invoice table
        if (updatedIds.length > 0) {
          // Set flag to prevent useEffect from clearing the filter during reset
          setIsUploadingInvoices(true);

          // Clear all filters and show only updated invoices
          setStatusFilter([]);
          setTypeFilter([]);
          setClientFilter([]);
          setContractFilter('All');
          setContractPercentageRangeMin('');
          setContractPercentageRangeMax('');
          setFrequencyFilter([]);
          setSearchTerm('');
          setDateFrom('');
          setDateTo('');
          setAgingFilter('All');
          setActiveStatBox(null);
          setSelectedExpectedInvoiceId(null);
          setGroupBy('None');
          setSecondaryGroupBy('None');
          setExpandedGroups({});
          setUploadedInvoiceIds(updatedIds);
          setShowOnlyUploadedInvoices(true);
          setShowInvoiceTable(true); // Show invoice table with updated invoices

          // Clear the upload flag after a brief delay
          setTimeout(() => setIsUploadingInvoices(false), 100);
        }
      }
      
    } catch (error) {
      showMessage('error', error.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  // Drag and drop handlers with improved state management
  const dragCounter = useRef(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Only show drag overlay if files are being dragged
    if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
      dragCounter.current++;
      setDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.current--;
    if (dragCounter.current === 0) {
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

    dragCounter.current = 0;
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  // Add global drag end handler to ensure state is cleared
  useEffect(() => {
    const handleDragEnd = () => {
      dragCounter.current = 0;
      setDragOver(false);
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragend', handleDragEnd);
    window.addEventListener('drop', handleDragEnd);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragend', handleDragEnd);
      window.removeEventListener('drop', handleDragEnd);
    };
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

  // Escape key handler for closing modals
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (selectedInvoice) {
          setSelectedInvoice(null);
        } else if (editingInvoice) {
          setEditingInvoice(null);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedInvoice, editingInvoice]);

  // Hide invoice table when search is cleared and no other filters are active
  useEffect(() => {
    // If search term is empty or just whitespace
    if (!searchTerm || !searchTerm.trim()) {
      // Check if there are any other active filters
      const hasOtherFilters =
        activeStatBox ||
        statusFilter.length > 0 ||
        agingFilter !== 'All' ||
        typeFilter.length > 0 ||
        clientFilter.length > 0 ||
        contractFilter !== 'All' ||
        showContractsWithNoValue ||
        contractPercentageRangeMin ||
        contractPercentageRangeMax ||
        frequencyFilter.length > 0 ||
        dateFrom ||
        dateTo ||
        (showOnlyUploadedInvoices && uploadedInvoiceIds.length > 0);

      // If no other filters and search was just cleared, hide the table
      if (!hasOtherFilters && showInvoiceTable) {
        setShowInvoiceTable(false);
      }
    }
  }, [searchTerm, activeStatBox, statusFilter, agingFilter, typeFilter, clientFilter,
      contractFilter, showContractsWithNoValue, contractPercentageRangeMin, contractPercentageRangeMax,
      frequencyFilter, dateFrom, dateTo, showOnlyUploadedInvoices, uploadedInvoiceIds, showInvoiceTable]);

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

  // Check if any filters are active
  const hasActiveFilters = () => {
    return (
      activeStatBox ||
      statusFilter.length > 0 ||
      agingFilter !== 'All' ||
      typeFilter.length > 0 ||
      clientFilter.length > 0 ||
      contractFilter !== 'All' ||
      showContractsWithNoValue ||
      contractPercentageRangeMin ||
      contractPercentageRangeMax ||
      frequencyFilter.length > 0 ||
      dateFrom ||
      dateTo ||
      (searchTerm && searchTerm.trim()) ||
      (showOnlyUploadedInvoices && uploadedInvoiceIds.length > 0)
    );
  };

  // Filter invoices
  const getFilteredInvoices = () => {
    let filtered = [...invoices];

    // Dashboard date range filter - apply when showing invoices from stat box
    // Filter by invoice date to match the dashboard period
    if (activeStatBox) {
      const dateRange = getDashboardDateRange();
      if (dateRange.from) {
        filtered = filtered.filter(inv => inv.invoiceDate >= dateRange.from);
      }
      if (dateRange.to) {
        filtered = filtered.filter(inv => inv.invoiceDate <= dateRange.to);
      }
    }

    // Status filter (multi-select)
    if (statusFilter.length > 0) {
      filtered = filtered.filter(inv =>
        statusFilter.some(status => matchesStatusFilter(inv, status)) &&
        !isExcludedFromCalculations(inv.invoiceType) // Exclude credit memos, vendor invoices, and POs from status filters
      );
    }

    // Aging filter
    if (agingFilter !== 'All') {
      filtered = filtered.filter(inv => {
        const bucket = getAgingBucket(inv);
        return bucket === agingFilter && !isExcludedFromCalculations(inv.invoiceType);
      });
    }

    // Type filter (multi-select)
    if (typeFilter.length > 0) {
      filtered = filtered.filter(inv => typeFilter.includes(inv.invoiceType));
    }

    // Client filter (multi-select)
    if (clientFilter.length > 0) {
      filtered = filtered.filter(inv =>
        clientFilter.some(client => normalizeClientName(inv.client) === normalizeClientName(client))
      );
    }

    // Contract filter
    if (contractFilter !== 'All') {
      filtered = filtered.filter(inv => inv.customerContract === contractFilter);
    }

    // Show only contracts with no value
    if (showContractsWithNoValue) {
      filtered = filtered.filter(inv => {
        if (!inv.customerContract) return false;
        const contractValue = contractValues[inv.customerContract]?.value;
        // Include if contract has no value entry OR value is null/0
        return !contractValue || contractValue === 0;
      });
    }

    // Contract percentage range filter
    if (contractPercentageRangeMin || contractPercentageRangeMax) {
      filtered = filtered.filter(inv => {
        if (!inv.customerContract) return false;
        const contractValue = contractValues[inv.customerContract]?.value;
        if (!contractValue || contractValue === 0) return false;

        // Calculate invoiced percentage
        const contractInvoices = invoices.filter(i => i.customerContract === inv.customerContract);
        const totalInvoiced = contractInvoices.reduce((sum, i) =>
          sum + convertToUSD(i.amountDue, i.currency), 0
        );
        const contractValueUSD = convertToUSD(contractValue, contractValues[inv.customerContract].currency);
        const percentage = (totalInvoiced / contractValueUSD) * 100;

        const min = contractPercentageRangeMin ? parseFloat(contractPercentageRangeMin) : 0;
        const max = contractPercentageRangeMax ? parseFloat(contractPercentageRangeMax) : 100;

        return percentage >= min && percentage <= max;
      });
    }

    // Frequency filter
    if (frequencyFilter.length > 0) {
      filtered = filtered.filter(inv => frequencyFilter.includes(inv.frequency));
    }

    // Date range filter (by due date)
    if (dateFrom) {
      filtered = filtered.filter(inv => inv.dueDate >= dateFrom && !isExcludedFromCalculations(inv.invoiceType));
    }
    if (dateTo) {
      filtered = filtered.filter(inv => inv.dueDate <= dateTo && !isExcludedFromCalculations(inv.invoiceType));
    }

    // Search filter
    if (searchTerm && typeof searchTerm === 'string') {
      const term = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(inv =>
        inv.invoiceNumber?.toLowerCase().includes(term) ||
        inv.client?.toLowerCase().includes(term) ||
        inv.customerContract?.toLowerCase().includes(term) ||
        inv.poNumber?.toLowerCase().includes(term) ||
        inv.services?.toLowerCase().includes(term)
      );
    }

    // Show only uploaded invoices filter
    if (showOnlyUploadedInvoices && uploadedInvoiceIds.length > 0) {
      filtered = filtered.filter(inv => uploadedInvoiceIds.includes(inv.id));
    }

    return filtered;
  };

  // Handle sorting
  const handleSort = (column) => {
    if (sortBy === column) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Sort invoices
  const sortInvoices = (invoices) => {
    return [...invoices].sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Handle null/undefined values
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      // Convert to USD for amount comparison
      if (sortBy === 'amountDue') {
        aVal = convertToUSD(a.amountDue, a.currency);
        bVal = convertToUSD(b.amountDue, b.currency);
      }

      // String comparison (case-insensitive)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      // Compare
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Get dashboard date range
  const getDashboardDateRange = () => {
    if (dashboardDateFilter === 'currentYear' || dashboardDateFilter === 'year') {
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
    } else if (dashboardDateFilter === 'custom') {
      return {
        from: dashboardCustomFrom,
        to: dashboardCustomTo
      };
    } else {
      // Default to current year
      const year = new Date().getFullYear();
      return {
        from: `${year}-01-01`,
        to: `${year}-12-31`
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

    // Separate credit memos from regular invoices, and exclude vendor invoices & POs from calculations
    const creditMemos = filtered.filter(inv => inv.invoiceType === 'Credit Memo');
    const regularInvoices = filtered.filter(inv => !isExcludedFromCalculations(inv.invoiceType));

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

  // Normalize client name by removing trailing period
  const normalizeClientName = (clientName) => {
    if (!clientName || clientName === 'Uncategorized') return clientName;
    return clientName.replace(/\.$/, '').trim();
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

        // Normalize client names to ignore trailing periods
        if (groupBy === 'Client') {
          primaryKey = normalizeClientName(primaryKey);
        }

        if (secondaryGroupBy !== 'None') {
          let secondaryKey = inv[secondaryGroupBy === 'Client' ? 'client' :
                                 secondaryGroupBy === 'Contract' ? 'customerContract' :
                                 secondaryGroupBy === 'Status' ? 'status' : 'invoiceType'] || 'Uncategorized';

          // Normalize client names in secondary grouping too
          if (secondaryGroupBy === 'Client') {
            secondaryKey = normalizeClientName(secondaryKey);
          }

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

  // Sort group names, with special handling for numeric contracts
  const getSortedGroupNames = (grouped) => {
    return Object.keys(grouped).sort((a, b) => {
      // Special handling when grouping by Contract
      if (groupBy === 'Contract') {
        // Extract the contract number from the group name (handle secondary grouping with " > ")
        const contractA = a.split(' > ')[0];
        const contractB = b.split(' > ')[0];

        // If both are "Uncategorized", they're equal
        if (contractA === 'Uncategorized' && contractB === 'Uncategorized') return 0;
        // "Uncategorized" always goes to the end
        if (contractA === 'Uncategorized') return 1;
        if (contractB === 'Uncategorized') return -1;

        // Try to parse as numbers
        const numA = parseInt(contractA, 10);
        const numB = parseInt(contractB, 10);

        // If both are numbers, sort numerically (ascending)
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }

        // If only one is a number, number comes first
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;

        // Otherwise, alphabetical sort
        return contractA.localeCompare(contractB);
      }

      // For other groupings, alphabetical sort
      return a.localeCompare(b);
    });
  };

  // Calculate aging statistics
  const calculateAgingStats = () => {
    // Exclude credit memos, vendor invoices, and POs from aging report (only regular unpaid invoices)
    let unpaidInvoices = invoices.filter(inv => inv.status === 'Pending' && !isExcludedFromCalculations(inv.invoiceType));

    // Apply aging client filter if any clients are selected
    if (agingClientFilter.length > 0) {
      unpaidInvoices = unpaidInvoices.filter(inv =>
        agingClientFilter.some(client => normalizeClientName(inv.client) === normalizeClientName(client))
      );
    }

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
      // Double-check to exclude credit memos, vendor invoices, and POs (defensive coding)
      if (bucket && buckets[bucket] && !isExcludedFromCalculations(inv.invoiceType)) {
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
    setClientFilter([]);
    setContractFilter('All');
    setContractPercentageRangeMin('');
    setContractPercentageRangeMax('');
    setFrequencyFilter([]);
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setAgingFilter('All');
    setActiveStatBox(null);
    setExpandedGroups({}); // Collapse all groups when clearing filters
    setShowInvoiceTable(false); // Hide invoice table when clearing all filters to prevent showing all invoices
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

  // Toggle client filter selection
  const toggleClient = (client) => {
    if (clientFilter.includes(client)) {
      setClientFilter(clientFilter.filter(c => c !== client));
    } else {
      setClientFilter([...clientFilter, client]);
    }
  };

  // Toggle aging client filter selection (for Aged Invoice Report)
  const toggleAgingClient = (client) => {
    if (agingClientFilter.includes(client)) {
      setAgingClientFilter(agingClientFilter.filter(c => c !== client));
    } else {
      setAgingClientFilter([...agingClientFilter, client]);
    }
  };

  // Reset aging client filter
  const resetAgingClientFilter = () => {
    setAgingClientFilter([]);
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
    setExpandedGroups({}); // Collapse all groups
    setShowInvoiceTable(false); // Hide table initially to prevent freeze
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);

    switch (statType) {
      case 'totalInvoiced':
        // Table is hidden, user can expand when ready
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
        break;
    }
  };

  // Handle aging bucket click
  const handleAgingClick = (bucket) => {
    clearFilters();
    setActiveStatBox('aging-' + bucket);
    setAgingFilter(bucket);
    // Apply aging client filter to main client filter to show filtered results
    if (agingClientFilter.length > 0) {
      setClientFilter([...agingClientFilter]);
    }
    setExpandedGroups({}); // Collapse all groups
    setShowInvoiceTable(false); // Hide table initially to prevent freeze
  };

  // Bulk selection handlers
  const handleSelectAll = (groupInvoices) => {
    const selectableInvoices = groupInvoices.filter(inv => !isExcludedFromCalculations(inv.invoiceType));
    const allSelected = selectableInvoices.every(inv => selectedInvoiceIds.includes(inv.id));

    if (allSelected) {
      // Deselect all from this group
      setSelectedInvoiceIds(selectedInvoiceIds.filter(id =>
        !selectableInvoices.some(inv => inv.id === id)
      ));
      setLastSelectedIndex(null);
    } else {
      // Select all from this group
      const newIds = selectableInvoices.map(inv => inv.id);
      setSelectedInvoiceIds([...new Set([...selectedInvoiceIds, ...newIds])]);
    }
  };

  const handleSelectInvoice = (invoiceId, isChecked, groupInvoices, shiftKey) => {
    // Filter out Credit Memos, Vendor Invoices, and POs from the group
    const selectableInvoices = groupInvoices.filter(inv => !isExcludedFromCalculations(inv.invoiceType));

    // Find the index of the current invoice in the selectable invoices array
    const currentIndex = selectableInvoices.findIndex(inv => inv.id === invoiceId);

    if (shiftKey && lastSelectedIndex !== null && currentIndex !== null && currentIndex !== -1) {
      // Shift+click: select range
      const start = Math.min(lastSelectedIndex, currentIndex);
      const end = Math.max(lastSelectedIndex, currentIndex);
      const rangeIds = selectableInvoices
        .slice(start, end + 1)
        .map(inv => inv.id);

      // Add range to selection
      setSelectedInvoiceIds([...new Set([...selectedInvoiceIds, ...rangeIds])]);
      setLastSelectedIndex(currentIndex);
    } else {
      // Normal click: toggle single item
      if (isChecked) {
        setSelectedInvoiceIds([...selectedInvoiceIds, invoiceId]);
      } else {
        setSelectedInvoiceIds(selectedInvoiceIds.filter(id => id !== invoiceId));
      }
      setLastSelectedIndex(currentIndex);
    }
  };

  const bulkUpdateInvoiceStatus = async (status) => {
    if (selectedInvoiceIds.length === 0) {
      showMessage('warning', 'No invoices selected');
      return;
    }

    try {
      await axios.put(`${API_URL}/invoices/bulk-status`, {
        invoiceIds: selectedInvoiceIds,
        status,
        paymentDate: status === 'Paid' ? new Date().toISOString().split('T')[0] : null
      });
      await loadInvoices();
      setSelectedInvoiceIds([]);
      setLastSelectedIndex(null);
      showMessage('success', `${selectedInvoiceIds.length} invoice(s) marked as ${status}`);
    } catch (error) {
      showMessage('error', 'Failed to update invoices');
    }
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

  // Save notes from quick edit modal
  const saveQuickEditNotes = async () => {
    try {
      await axios.put(`${API_URL}/invoices/${quickEditInvoice.id}`, {
        notes: quickEditNotes
      });
      await loadInvoices();
      setQuickEditInvoice(null);
      setQuickEditNotes('');
      showMessage('success', 'Notes updated successfully');
    } catch (error) {
      showMessage('error', 'Failed to update notes');
    }
  };

  // Delete invoice (admin only)
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

  // Delete individual duplicate invoice (all authenticated users)
  const deleteSingleDuplicate = async (id) => {
    if (!window.confirm('Are you sure you want to delete this duplicate invoice?')) return;

    try {
      await axios.delete(`${API_URL}/invoices/duplicate/${id}`);
      await loadInvoices();
      await loadDuplicates();

      // Reload duplicate details if viewing them
      if (selectedDuplicate) {
        await loadDuplicateDetails(selectedDuplicate);
      }

      showMessage('success', 'Duplicate invoice deleted');
    } catch (error) {
      showMessage('error', 'Failed to delete duplicate invoice');
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
  const startEditInvoice = async (invoice) => {
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
      frequency: invoice.frequency || 'adhoc',
      notes: invoice.notes || ''
    });

    // Load attachments for this invoice
    try {
      const response = await axios.get(`${API_URL}/invoices/${invoice.id}/attachments`);
      setAttachments(response.data);
    } catch (error) {
      console.error('Error loading attachments:', error);
      setAttachments([]);
    }
  };

  const handleAttachmentUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_URL}/invoices/${editingInvoice.id}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setAttachments([response.data, ...attachments]);
      showMessage('success', 'File attached successfully');
      event.target.value = ''; // Reset file input
    } catch (error) {
      showMessage('error', `Failed to upload attachment: ${error.response?.data?.error || error.message}`);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return;

    try {
      await axios.delete(`${API_URL}/attachments/${attachmentId}`);
      setAttachments(attachments.filter(att => att.id !== attachmentId));
      showMessage('success', 'Attachment deleted');
    } catch (error) {
      showMessage('error', `Failed to delete attachment: ${error.response?.data?.error || error.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const saveEditInvoice = async () => {
    try {
      await axios.put(`${API_URL}/invoices/${editingInvoice.id}`, editForm);
      await loadInvoices();
      await loadDuplicates(); // Refresh duplicates in case changes affect duplicate status

      // If we're viewing duplicate details, reload them to show the updated data
      if (selectedDuplicate && duplicateDetails.length > 0) {
        await loadDuplicateDetails(selectedDuplicate);
      }

      setEditingInvoice(null);
      setSelectedInvoice(null);
      setAttachments([]);
      showMessage('success', 'Invoice updated');
    } catch (error) {
      showMessage('error', `Failed to update invoice: ${error.response?.data?.error || error.message}`);
    }
  };

  const checkSAHealthStatus = async (invoiceId) => {
    if (checkingSAHealth) return; // Prevent multiple clicks

    try {
      setCheckingSAHealth(true);
      console.log('Checking SA Health status for invoice:', invoiceId);
      console.log('API URL:', `${API_URL}/invoices/${invoiceId}/check-sa-health-status`);
      showMessage('info', 'Checking SA Health status... This may take up to 10 seconds.');

      const response = await axios.post(`${API_URL}/invoices/${invoiceId}/check-sa-health-status`);
      console.log('SA Health status response:', response.data);

      if (response.data.success) {
        // Update the edit form with the new notes
        setEditForm({
          ...editForm,
          notes: response.data.invoice.notes
        });

        // Update the editing invoice to reflect changes
        setEditingInvoice(response.data.invoice);

        showMessage('success', `SA Health status: ${response.data.statusInfo.status}`);

        // Reload invoices to reflect any status changes
        await loadInvoices();
      }
    } catch (error) {
      console.error('SA Health status check error:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      console.error('Error details:', error.response?.data);

      let errorMessage = 'Failed to check SA Health status';
      if (error.response?.data?.error) {
        errorMessage += ': ' + error.response.data.error;
      } else if (error.message) {
        errorMessage += ': ' + error.message;
      }

      showMessage('error', errorMessage);
    } finally {
      setCheckingSAHealth(false);
    }
  };

  const createManualInvoice = async () => {
    try {
      // Validate required fields
      if (!createForm.invoiceNumber || !createForm.client || !createForm.invoiceDate) {
        showMessage('error', 'Invoice number, client, and invoice date are required');
        return;
      }

      const response = await axios.post(`${API_URL}/invoices/create-manual`, createForm);
      await loadInvoices();
      await loadDuplicates();

      // Show the newly created invoice in the table (similar to upload behavior)
      if (response.data.invoice && response.data.invoice.id) {
        setUploadedInvoiceIds([response.data.invoice.id]);
        setShowOnlyUploadedInvoices(true);
      }

      setCreatingInvoice(false);
      setCreateForm({});
      setShowInvoiceTable(true); // Show invoice table with the newly created invoice
      showMessage('success', 'Invoice created successfully');
    } catch (error) {
      if (error.response?.status === 409) {
        showMessage('error', 'Duplicate invoice: This invoice already exists');
      } else {
        showMessage('error', `Failed to create invoice: ${error.response?.data?.error || error.message}`);
      }
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
      // Toggle: if clicking the same contract again, clear the selection
      if (selectedExpectedInvoiceId === expectedInvoiceId) {
        setSelectedExpectedInvoiceId(null);
        setContractFilter('');
        return;
      }

      // Clear all other filters first
      clearFilters();
      setContractFilter(contract);
      setSelectedExpectedInvoiceId(expectedInvoiceId);
      setExpandedGroups({}); // Collapse all groups to prevent freeze
      setShowInvoiceTable(false); // Hide table initially to prevent freeze
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

  const loadDuplicateDetails = async (duplicate) => {
    try {
      // Use the new IDs-based endpoint to handle empty invoice numbers
      const response = await axios.post(`${API_URL}/invoices/duplicates/by-ids`, { ids: duplicate.ids });
      setDuplicateDetails(response.data);
      setSelectedDuplicate(duplicate);

      // Filter the invoice table to show only this invoice number (if not empty)
      if (duplicate.invoiceNumber && duplicate.invoiceNumber.trim()) {
        setSearchTerm(duplicate.invoiceNumber);
      } else {
        // For empty invoice numbers, we'll show all invoices but highlight in the message
        setSearchTerm('');
      }
      setShowInvoiceTable(true);
    } catch (error) {
      showMessage('error', `Failed to load duplicate details: ${error.response?.data?.error || error.message}`);
    }
  };

  const deleteDuplicates = async (duplicate) => {
    const invoiceDesc = duplicate.invoiceNumber || '(no invoice number)';
    if (!window.confirm(`Delete all duplicate invoices for "${invoiceDesc}" (${duplicate.client}) except the most recent?`)) return;

    try {
      // Use the new IDs-based endpoint
      await axios.post(`${API_URL}/invoices/duplicates/delete-by-ids`, { ids: duplicate.ids });
      await loadDuplicates();
      await loadInvoices();
      setSelectedDuplicate(null);
      setDuplicateDetails([]);
      setSearchTerm(''); // Clear search filter after deleting duplicates
      setExpandedGroups({}); // Collapse all groups after deleting duplicates
      setShowInvoiceTable(false); // Hide invoice table after deleting duplicates
      showMessage('success', 'Duplicate invoices deleted');
    } catch (error) {
      showMessage('error', 'Failed to delete duplicates');
    }
  };

  // Get unique values for filters
  // Normalize client names to remove duplicates with/without trailing periods
  const clientsMap = new Map();
  invoices.forEach(inv => {
    const normalized = normalizeClientName(inv.client);
    if (!clientsMap.has(normalized)) {
      // Store the normalized name as key, use version without trailing period as display value
      clientsMap.set(normalized, inv.client.replace(/\.$/, ''));
    }
  });
  const clients = [...clientsMap.values()].sort();
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
            {/* Refresh Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={refreshAllData}
                disabled={isRefreshing}
                className={`px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-white hover:bg-opacity-30 transition font-medium ${
                  isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title={`Last refresh: ${lastRefresh.toLocaleTimeString()}`}
              >
                {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
              </button>
              <label className="flex items-center gap-2 px-3 py-2 bg-white bg-opacity-20 rounded-lg cursor-pointer hover:bg-white hover:bg-opacity-30 transition">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-sm text-white font-medium">Auto-refresh (30s)</span>
              </label>
            </div>

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
              onClick={() => window.open('/training-guide.html', 'InvoiceTrackerHelp', 'width=1200,height=800,scrollbars=yes,resizable=yes')}
              className="px-6 py-3 bg-white bg-opacity-20 text-white rounded-lg hover:bg-white hover:bg-opacity-30 transition font-semibold border-2 border-white"
              title="Open Training Guide in new window"
            >
              Help
            </button>
            <button
              onClick={onNavigateToAnalytics}
              className="px-6 py-3 bg-white text-[#707CF1] rounded-lg hover:bg-gray-100 transition shadow font-semibold"
            >
              View Analytics →
            </button>
          </div>
        </div>

        {/* Flash Notification Overlay */}
        {flashNotification.show && (
          <div
            className={`fixed inset-0 pointer-events-none z-40 transition-opacity duration-300 ${
              flashNotification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            } opacity-30`}
          />
        )}

        {/* Message */}
        {message.text && (
          <div
            onClick={message.type === 'error' ? dismissMessage : undefined}
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-100 text-green-800' :
              message.type === 'error' ? 'bg-red-100 text-red-800 cursor-pointer hover:bg-red-200' :
              'bg-yellow-100 text-yellow-800'
            } ${message.type === 'error' ? 'relative' : ''}`}
          >
            {message.text}
            {message.type === 'error' && (
              <span className="ml-2 text-xs">(Click to dismiss)</span>
            )}
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

          <button
            onClick={() => {
              setCreatingInvoice(true);
              setCreateForm({
                invoiceNumber: '',
                client: '',
                invoiceDate: new Date().toISOString().split('T')[0],
                dueDate: '',
                amountDue: '',
                currency: 'USD',
                customerContract: '',
                poNumber: '',
                invoiceType: 'PS',
                frequency: 'adhoc',
                services: '',
                notes: '',
                status: 'Pending'
              });
            }}
            className="px-6 py-3 bg-[#707CF1] text-white rounded-lg hover:bg-[#5a66d9] cursor-pointer transition"
          >
            Create Invoice
          </button>

          <label className="px-6 py-3 bg-[#00BBBA] text-black rounded-lg hover:bg-[#009a99] cursor-pointer transition">
            Upload Payment Sheet
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </label>

          {/* Delete All button permanently hidden for production */}
          {false && (
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
              <option value="currentYear">This Calendar Year</option>
              <option value="allTime">All Time</option>
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
                setStatusFilter([]);
                setTypeFilter(['Credit Memo']);
                setClientFilter([]);
                setContractFilter('All');
                setAgingFilter('All');
                setSearchTerm('');
                setDateFrom('');
                setDateTo('');
                setExpandedGroups({}); // Collapse all groups
                setShowInvoiceTable(false); // Hide table initially to prevent freeze
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
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-bold text-white">Aged Invoice Report (Unpaid Only)</h2>
            <div className="flex gap-2">
              <div className="relative">
                <button
                  onClick={() => {
                    document.getElementById('aging-report-client-filter').classList.toggle('hidden');
                    setAgingClientSearchTerm('');
                  }}
                  className="px-4 py-2 bg-white text-[#707CF1] rounded-lg hover:bg-gray-100 transition text-sm font-medium border-2 border-white"
                >
                  Filter by Client {agingClientFilter.length > 0 && `(${agingClientFilter.length})`}
                </button>
                <div id="aging-report-client-filter" className="hidden absolute right-0 mt-2 w-72 bg-white border rounded-lg shadow-lg z-10">
                  <div className="p-3 border-b">
                    <input
                      type="text"
                      value={agingClientSearchTerm}
                      onChange={(e) => setAgingClientSearchTerm(e.target.value)}
                      placeholder="Search clients..."
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div className="max-h-64 overflow-y-auto p-3">
                    <div className="space-y-1">
                      {clients
                        .filter(client =>
                          client.toLowerCase().includes(agingClientSearchTerm.toLowerCase())
                        )
                        .map(client => (
                          <label key={client} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={agingClientFilter.includes(client)}
                              onChange={() => toggleAgingClient(client)}
                              className="w-4 h-4 text-purple-600 cursor-pointer"
                            />
                            <span className="text-sm">{client}</span>
                          </label>
                        ))}
                      {clients.filter(client =>
                        client.toLowerCase().includes(agingClientSearchTerm.toLowerCase())
                      ).length === 0 && (
                        <div className="text-sm text-gray-500 italic py-2 text-center">
                          No clients found
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {agingClientFilter.length > 0 && (
                <button
                  onClick={resetAgingClientFilter}
                  className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition text-sm font-medium border-2 border-white"
                >
                  Reset Filter
                </button>
              )}
              <button
                onClick={() => {
                  resetAgingClientFilter();
                  clearFilters();
                  setActiveStatBox(null);
                  setAgingFilter('All');
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium border-2 border-red-500"
              >
                Clear All Filters
              </button>
            </div>
          </div>
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

        {/* Expected Invoices */}
        <div className="mb-6">
          {/* Unacknowledged */}
          <div className="bg-[#707CF1] rounded-lg shadow mb-2">
            <div className="w-full px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg text-white">
                  Expected Invoices - Unacknowledged ({unacknowledgedExpected.length})
                </span>
                <button
                  onClick={() => setShowExpectedUnack(!showExpectedUnack)}
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
            </div>
            
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
            <div className="w-full px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg text-white">
                  Expected Invoices - Acknowledged ({acknowledgedExpected.length})
                </span>
                <button
                  onClick={() => setShowExpectedAck(!showExpectedAck)}
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
            </div>
            
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
          <div className="w-full px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg text-red-600">
                Duplicate Invoices ({duplicates.length})
              </span>
              <button
                onClick={() => setShowDuplicates(!showDuplicates)}
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
          </div>

          {showDuplicates && (
            <div className="px-6 pb-6">
              {duplicates.length === 0 ? (
                <p className="text-gray-500 italic">No duplicate invoices found</p>
              ) : (
                <div>
                  <div className="mb-4 text-sm text-gray-600">
                    <p>These invoices have the same invoice number, client, AND invoice date. Click "View Details" to see all instances, or "Delete Duplicates" to keep only the most recent version.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border rounded">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Invoice Number</th>
                          <th className="px-4 py-2 text-left">Client</th>
                          <th className="px-4 py-2 text-left">Invoice Date</th>
                          <th className="px-4 py-2 text-left">Count</th>
                          <th className="px-4 py-2 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {duplicates.map((dup, index) => (
                          <tr key={`${dup.invoiceNumber}-${dup.client}-${dup.invoiceDate}-${index}`} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-900">{dup.invoiceNumber || '(no invoice number)'}</td>
                            <td className="px-4 py-2 text-gray-900">{dup.client}</td>
                            <td className="px-4 py-2 text-gray-900">{dup.invoiceDate || '(no date)'}</td>
                            <td className="px-4 py-2 text-gray-900">{dup.count}</td>
                            <td className="px-4 py-2">
                              <button
                                onClick={() => loadDuplicateDetails(dup)}
                                className="px-3 py-1 bg-[#0076A2] text-white rounded text-sm hover:bg-[#005a7a] mr-2"
                              >
                                View Details
                              </button>
                              <button
                                onClick={() => deleteDuplicates(dup)}
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
                          All Instances of "{selectedDuplicate.invoiceNumber}" ({selectedDuplicate.client})
                        </h3>
                        <button
                          onClick={() => {
                            setSelectedDuplicate(null);
                            setDuplicateDetails([]);
                            setSearchTerm(''); // Clear search term when closing duplicate details
                            // Also hide invoice table if it has no other active filters
                            const hasOtherFilters =
                              activeStatBox ||
                              statusFilter.length > 0 ||
                              agingFilter !== 'All' ||
                              typeFilter.length > 0 ||
                              clientFilter.length > 0 ||
                              contractFilter !== 'All' ||
                              showContractsWithNoValue ||
                              contractPercentageRangeMin ||
                              contractPercentageRangeMax ||
                              frequencyFilter.length > 0 ||
                              dateFrom ||
                              dateTo ||
                              (showOnlyUploadedInvoices && uploadedInvoiceIds.length > 0);
                            if (!hasOtherFilters) {
                              setShowInvoiceTable(false);
                            }
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
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => startEditInvoice(inv)}
                                      className="px-3 py-1 bg-[#0076A2] text-white rounded text-sm hover:bg-[#005a7a]"
                                    >
                                      View/Edit
                                    </button>
                                    <button
                                      onClick={() => deleteSingleDuplicate(inv.id)}
                                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                                    >
                                      Delete
                                    </button>
                                  </div>
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
          <div className="mb-4">
            <div className="flex items-center gap-3 mb-3">
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
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search invoice #, PO #, client, contract, description..."
                className="flex-1 max-w-md border rounded px-3 py-2"
              />
              <div className="bg-white border rounded px-3 py-2">
                <label className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 px-1 rounded whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={showContractsWithNoValue}
                    onChange={(e) => {
                      setShowContractsWithNoValue(e.target.checked);
                      if (e.target.checked) {
                        setGroupBy('Contract');
                        setSecondaryGroupBy('Client');
                      }
                    }}
                    className="w-4 h-4 text-purple-600 cursor-pointer"
                  />
                  <span className="text-sm">Contracts with no value</span>
                </label>
              </div>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-[#151744] text-white rounded hover:bg-[#0d0e2a] transition whitespace-nowrap"
              >
                Clear All Filters
              </button>
            </div>
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
                {['PS', 'Maint', 'Sub', 'Hosting', 'MS', 'SW', 'HW', '3PP', 'Credit Memo', 'Vendor Invoice', 'Purchase Order'].map(type => (
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
              <label className="block text-sm font-medium mb-2 text-white">
                Client {clientFilter.length > 0 && `(${clientFilter.length} selected)`}
              </label>
              <div className="bg-white border rounded overflow-hidden">
                <div className="p-2 border-b bg-gray-50">
                  <input
                    type="text"
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    placeholder="Search clients..."
                    className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div className="px-3 py-2 max-h-48 overflow-y-auto space-y-1">
                  {clients
                    .filter(client =>
                      client.toLowerCase().includes(clientSearchTerm.toLowerCase())
                    )
                    .map(client => (
                      <label key={client} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input
                          type="checkbox"
                          checked={clientFilter.includes(client)}
                          onChange={() => {
                            toggleClient(client);
                            setActiveStatBox(null);
                          }}
                          className="w-4 h-4 text-purple-600 cursor-pointer"
                        />
                        <span className="text-sm">{client}</span>
                      </label>
                    ))}
                  {clients.filter(client =>
                    client.toLowerCase().includes(clientSearchTerm.toLowerCase())
                  ).length === 0 && (
                    <div className="text-sm text-gray-500 italic py-2 text-center">
                      No clients found
                    </div>
                  )}
                </div>
              </div>
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
              <label className="block text-sm font-medium mb-1 text-white">Contract % Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={contractPercentageRangeMin}
                  onChange={(e) => setContractPercentageRangeMin(e.target.value)}
                  placeholder="Min %"
                  min="0"
                  max="100"
                  className="w-1/2 border rounded px-3 py-2"
                />
                <input
                  type="number"
                  value={contractPercentageRangeMax}
                  onChange={(e) => setContractPercentageRangeMax(e.target.value)}
                  placeholder="Max %"
                  min="0"
                  max="100"
                  className="w-1/2 border rounded px-3 py-2"
                />
              </div>
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
          </div>
          )}
        </div>

        {/* Grouping */}
        <div className="bg-[#707CF1] p-6 rounded-lg shadow mb-6">
          <div className="flex gap-4 items-end flex-wrap">
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
                    if (hasActiveFilters()) {
                      const newExpanded = {};
                      Object.keys(groupedInvoices).forEach(key => {
                        newExpanded[key] = true;
                      });
                      setExpandedGroups(newExpanded);
                    }
                  }}
                  disabled={!hasActiveFilters()}
                  className={`px-4 py-2 rounded transition ${
                    hasActiveFilters()
                      ? 'bg-[#151744] text-white hover:bg-[#0d0e2a] cursor-pointer'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  title={
                    hasActiveFilters()
                      ? 'Expand all groups'
                      : 'Expand All is disabled when viewing all invoices. Please apply a filter or search to use this feature.'
                  }
                >
                  Expand All
                </button>

                <button
                  onClick={() => setExpandedGroups({})}
                  className="px-4 py-2 bg-[#151744] text-white rounded hover:bg-[#0d0e2a] transition"
                >
                  Collapse All
                </button>
              </>
            )}
          </div>
        </div>

        {/* Invoice Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="w-full px-6 py-4 flex justify-between items-center hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg">
                Invoices ({filteredInvoices.length})
              </span>
              <button
                onClick={() => {
                  if (hasActiveFilters() || showInvoiceTable) {
                    setShowInvoiceTable(!showInvoiceTable);
                  }
                }}
                disabled={!hasActiveFilters() && !showInvoiceTable}
                className={`px-3 py-1 rounded transition text-sm flex items-center gap-1 ${
                  hasActiveFilters() || showInvoiceTable
                    ? 'bg-[#707CF1] text-white hover:bg-[#5a6ad9] cursor-pointer'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={
                  showInvoiceTable
                    ? "Collapse Invoices"
                    : hasActiveFilters()
                    ? "Expand Invoices"
                    : "To view invoices, please apply a filter or search. This prevents performance issues with large datasets."
                }
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
            {!hasActiveFilters() && !showInvoiceTable && (
              <div className="text-sm text-gray-600 italic">
                Apply a filter or search to view invoices
              </div>
            )}
          </div>

          {showInvoiceTable && (
            <div className="px-6 pb-6">
              {getSortedGroupNames(groupedInvoices).map(groupName => {
                const groupInvs = sortInvoices(groupedInvoices[groupName]);
                // Exclude Purchase Orders, Vendor Invoices, and Credit Memos from contract totals
                const groupTotal = groupInvs
                  .filter(inv => !isExcludedFromCalculations(inv.invoiceType))
                  .reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);
                // Always show invoices when no grouping, otherwise use collapsed by default
                const isExpanded = groupBy === 'None' ? true : expandedGroups[groupName] === true;

                // Extract contract from group name if grouping by contract
                const isContractGroup = groupBy === 'Contract' && groupName !== 'Uncategorized';
                const contractName = isContractGroup ? groupName.split(' > ')[0] : null;
                const contractInfo = contractName ? contractValues[contractName] : null;
                const contractValueUSD = contractInfo ? convertToUSD(contractInfo.value, contractInfo.currency) : 0;
                const totalPaid = groupInvs
                  .filter(inv => inv.status === 'Paid' && !isExcludedFromCalculations(inv.invoiceType))
                  .reduce((sum, inv) => sum + convertToUSD(inv.amountDue, inv.currency), 0);
                const remaining = contractValueUSD - groupTotal;
                // Cap percentage at 100% (exchange rate fluctuations can cause values over 100%)
                const percentage = contractValueUSD > 0 ? Math.min(Math.round((groupTotal / contractValueUSD) * 100), 100) : 0;
                
                return (
                  <div key={groupName} className="mb-4">
                    {groupBy !== 'None' && (
                      <div className="bg-gray-100 px-4 py-3 rounded">
                        <div
                          onClick={(e) => {
                            // Don't toggle when clicking on input fields
                            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
                              setExpandedGroups({
                                ...expandedGroups,
                                [groupName]: !isExpanded
                              });
                            }
                          }}
                          className="cursor-pointer hover:bg-gray-200 transition p-2 rounded"
                        >
                          <div className="flex justify-between items-center">
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

                          {/* Contract Value Management - Always visible for contract groups */}
                          {isContractGroup && (
                            <div className="flex gap-4 items-center justify-between mt-3 pt-3 border-t border-gray-300">
                              <div className="flex gap-2 items-center">
                                <label className="text-sm font-medium">Contract Value:</label>
                                <input
                                  type="text"
                                  placeholder="Enter amount"
                                  value={contractInfo?.value ? Math.round(Number(contractInfo.value)).toLocaleString('en-US') : ''}
                                  onChange={(e) => {
                                    // Remove commas and parse number
                                    const numericValue = e.target.value.replace(/,/g, '');
                                    // Only update if it's a valid integer or empty
                                    if (numericValue === '' || (!isNaN(numericValue) && Number.isInteger(Number(numericValue)))) {
                                      const newValues = {
                                        ...contractValues,
                                        [contractName]: {
                                          value: numericValue,
                                          currency: contractInfo?.currency || 'USD'
                                        }
                                      };
                                      setContractValues(newValues);
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const numericValue = e.target.value.replace(/,/g, '');
                                    // Round to nearest integer when saving
                                    const roundedValue = numericValue ? Math.round(Number(numericValue)) : 0;
                                    saveContractValue(contractName, roundedValue, contractInfo?.currency || 'USD');
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="border rounded px-3 py-1 w-32 text-right"
                                />
                                <select
                                  value={contractInfo?.currency || 'USD'}
                                  onChange={(e) => saveContractValue(contractName, contractInfo?.value || 0, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="border rounded px-2 py-1"
                                >
                                  <option value="USD">USD</option>
                                  <option value="AUD">AUD</option>
                                  <option value="EUR">EUR</option>
                                  <option value="GBP">GBP</option>
                                  <option value="SGD">SGD</option>
                                  <option value="NZD">NZD</option>
                                </select>
                              </div>
                              {contractValueUSD > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">Progress:</span>
                                  <span className="font-bold text-blue-600">{percentage}%</span>
                                  <div className="w-24 bg-gray-200 rounded-full h-3">
                                    <div
                                      className="bg-blue-600 h-3 rounded-full transition-all"
                                      style={{ width: `${Math.min(percentage, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Contract Progress Metrics - Only visible when expanded */}
                        {isContractGroup && isExpanded && contractValueUSD > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-300 space-y-2">
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
                    
                    {isExpanded && (
                      <div className="overflow-x-auto mt-2">
                        {/* Bulk Action Buttons */}
                        {selectedInvoiceIds.length > 0 && (
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
                            <span className="font-semibold text-blue-900">
                              {selectedInvoiceIds.length} invoice(s) selected
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => bulkUpdateInvoiceStatus('Paid')}
                                className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium"
                              >
                                Mark as Paid
                              </button>
                              <button
                                onClick={() => bulkUpdateInvoiceStatus('Pending')}
                                className="px-4 py-2 bg-[#0076A2] text-white rounded text-sm hover:bg-[#005a7a] font-medium"
                              >
                                Mark as Unpaid
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedInvoiceIds([]);
                                  setLastSelectedIndex(null);
                                }}
                                className="px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 font-medium"
                              >
                                Clear Selection
                              </button>
                            </div>
                          </div>
                        )}
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left">
                                <input
                                  type="checkbox"
                                  onChange={() => handleSelectAll(groupInvs)}
                                  checked={groupInvs.filter(inv => !isExcludedFromCalculations(inv.invoiceType)).length > 0 && groupInvs.filter(inv => !isExcludedFromCalculations(inv.invoiceType)).every(inv => selectedInvoiceIds.includes(inv.id))}
                                  className="w-4 h-4 cursor-pointer"
                                  title="Select/Deselect all"
                                />
                              </th>
                              <th className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('invoiceNumber')}>
                                <div className="flex items-center gap-1">
                                  Invoice #
                                  {sortBy === 'invoiceNumber' && (
                                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('client')}>
                                <div className="flex items-center gap-1">
                                  Client
                                  {sortBy === 'client' && (
                                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('customerContract')}>
                                <div className="flex items-center gap-1">
                                  Contract
                                  {sortBy === 'customerContract' && (
                                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('poNumber')}>
                                <div className="flex items-center gap-1">
                                  PO Number
                                  {sortBy === 'poNumber' && (
                                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('invoiceType')}>
                                <div className="flex items-center gap-1">
                                  Type
                                  {sortBy === 'invoiceType' && (
                                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('invoiceDate')}>
                                <div className="flex items-center gap-1">
                                  Date
                                  {sortBy === 'invoiceDate' && (
                                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('dueDate')}>
                                <div className="flex items-center gap-1">
                                  Due Date
                                  {sortBy === 'dueDate' && (
                                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('amountDue')}>
                                <div className="flex items-center gap-1">
                                  Amount
                                  {sortBy === 'amountDue' && (
                                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('status')}>
                                <div className="flex items-center gap-1">
                                  Status
                                  {sortBy === 'status' && (
                                    <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                                  )}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupInvs.map((inv) => (
                              <tr
                                key={inv.id}
                                className={`border-t hover:bg-gray-50 cursor-pointer ${
                                  highlightedInvoiceId === inv.id ? 'bg-yellow-100 ring-2 ring-yellow-400' :
                                  selectedInvoiceIds.includes(inv.id) ? 'bg-blue-50' : ''
                                }`}
                                onClick={(e) => {
                                  // Don't toggle highlight if clicking checkbox or invoice number button
                                  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
                                    if (highlightedInvoiceId === inv.id) {
                                      setHighlightedInvoiceId(null); // Remove highlight if clicking already highlighted row
                                    } else {
                                      setHighlightedInvoiceId(inv.id); // Highlight this invoice
                                    }
                                  }
                                }}
                              >
                                <td className="px-4 py-2">
                                  {isExcludedFromCalculations(inv.invoiceType) ? (
                                    <span className="text-gray-400 text-sm">-</span>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={selectedInvoiceIds.includes(inv.id)}
                                      onChange={(e) => handleSelectInvoice(inv.id, e.target.checked, groupInvs, e.nativeEvent.shiftKey)}
                                      className="w-4 h-4 cursor-pointer"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => setSelectedInvoice(inv)}
                                      className="text-blue-600 hover:underline font-semibold"
                                    >
                                      {inv.invoiceNumber || '(no invoice number)'}
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setQuickEditInvoice(inv);
                                        setQuickEditNotes(inv.notes || '');
                                      }}
                                      className="text-gray-500 hover:text-blue-600 transition"
                                      title="Quick view services and edit notes"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                      </svg>
                                    </button>
                                  </div>
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
                                  {['Purchase Order', 'Credit Memo'].includes(inv.invoiceType) ? (
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
                                  {['Purchase Order', 'Credit Memo'].includes(inv.invoiceType) ? (
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

        {/* Quick Edit Modal - Services and Notes */}
        {quickEditInvoice && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setQuickEditInvoice(null);
              setQuickEditNotes('');
            }}
          >
            <div
              className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Quick View - Invoice {quickEditInvoice.invoiceNumber}</h2>
                <button
                  onClick={() => {
                    setQuickEditInvoice(null);
                    setQuickEditNotes('');
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Services Section */}
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-3 text-gray-800 border-b pb-2">Services (from uploaded file)</h3>
                {quickEditInvoice.services ? (
                  <div className="bg-gray-50 rounded p-4">
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">
                      {quickEditInvoice.services}
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500 italic text-sm bg-gray-50 rounded p-4">
                    No services information available (upload invoice file to extract services)
                  </div>
                )}
              </div>

              {/* Notes Section */}
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-3 text-gray-800 border-b pb-2">Notes</h3>
                <textarea
                  value={quickEditNotes}
                  onChange={(e) => setQuickEditNotes(e.target.value)}
                  className="w-full border rounded p-3 min-h-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add notes about this invoice..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setQuickEditInvoice(null);
                    setQuickEditNotes('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={saveQuickEditNotes}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Detail Modal */}
        {selectedInvoice && !editingInvoice && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4"
          >
            <div
              className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
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
                    <div className="font-bold">{selectedInvoice.invoiceNumber || '(no invoice number)'}</div>
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
                    href={`${BASE_URL}${encodeURI(selectedInvoice.pdfPath)}`}
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

                {isAdmin && (
                  <button
                    onClick={() => {
                      deleteInvoice(selectedInvoice.id);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                  >
                    Delete Invoice
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Invoice Modal */}
        {creatingInvoice && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4"
          >
            <div
              className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Create Invoice</h2>
                <button
                  onClick={() => {
                    setCreatingInvoice(false);
                    setCreateForm({});
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Invoice Number <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={createForm.invoiceNumber || ''}
                      onChange={(e) => setCreateForm({...createForm, invoiceNumber: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Required"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Client <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={createForm.client || ''}
                      onChange={(e) => setCreateForm({...createForm, client: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Required"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Contract Number</label>
                    <input
                      type="text"
                      value={createForm.customerContract || ''}
                      onChange={(e) => setCreateForm({...createForm, customerContract: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">PO Number</label>
                    <input
                      type="text"
                      value={createForm.poNumber || ''}
                      onChange={(e) => setCreateForm({...createForm, poNumber: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select
                      value={createForm.invoiceType || 'PS'}
                      onChange={(e) => setCreateForm({...createForm, invoiceType: e.target.value})}
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
                      <option value="Vendor Invoice">Vendor Invoice</option>
                      <option value="Purchase Order">Purchase Order</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Currency</label>
                    <select
                      value={createForm.currency || 'USD'}
                      onChange={(e) => setCreateForm({...createForm, currency: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="USD">USD</option>
                      <option value="AUD">AUD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="SGD">SGD</option>
                      <option value="NZD">NZD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Frequency</label>
                    <select
                      value={createForm.frequency || 'adhoc'}
                      onChange={(e) => setCreateForm({...createForm, frequency: e.target.value})}
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
                      type="text"
                      value={createForm.amountDue ? Math.round(Number(createForm.amountDue)).toLocaleString('en-US') : ''}
                      onChange={(e) => {
                        const numericValue = e.target.value.replace(/,/g, '');
                        if (numericValue === '' || (!isNaN(numericValue) && Number.isInteger(Number(numericValue)))) {
                          setCreateForm({...createForm, amountDue: numericValue === '' ? 0 : Number(numericValue)});
                        }
                      }}
                      className="w-full border rounded px-3 py-2"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Invoice Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={createForm.invoiceDate || ''}
                      onChange={(e) => setCreateForm({...createForm, invoiceDate: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Due Date</label>
                    <input
                      type="date"
                      value={createForm.dueDate || ''}
                      onChange={(e) => setCreateForm({...createForm, dueDate: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select
                      value={createForm.status || 'Pending'}
                      onChange={(e) => setCreateForm({...createForm, status: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Services</label>
                  <textarea
                    value={createForm.services || ''}
                    onChange={(e) => setCreateForm({...createForm, services: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    rows="4"
                    placeholder="Enter service description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={createForm.notes || ''}
                    onChange={(e) => setCreateForm({...createForm, notes: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    rows="3"
                    placeholder="Add any additional notes..."
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded px-4 py-3">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Attachments can be added after creating the invoice by editing it.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setCreatingInvoice(false);
                    setCreateForm({});
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={createManualInvoice}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                >
                  Create Invoice
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Invoice Modal */}
        {editingInvoice && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4"
          >
            <div
              className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">Edit Invoice</h2>
                <button
                  onClick={() => {
                    setEditingInvoice(null);
                    setAttachments([]);
                  }}
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
                      <option value="Vendor Invoice">Vendor Invoice</option>
                      <option value="Purchase Order">Purchase Order</option>
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
                      <option value="NZD">NZD</option>
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
                      type="text"
                      value={editForm.amountDue ? Math.round(Number(editForm.amountDue)).toLocaleString('en-US') : ''}
                      onChange={(e) => {
                        // Remove commas and parse number
                        const numericValue = e.target.value.replace(/,/g, '');
                        // Only update if it's a valid integer or empty
                        if (numericValue === '' || (!isNaN(numericValue) && Number.isInteger(Number(numericValue)))) {
                          setEditForm({...editForm, amountDue: numericValue === '' ? 0 : Number(numericValue)});
                        }
                      }}
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

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium">Notes</label>
                    {editingInvoice.client?.toLowerCase() === 'south australia health' && (
                      <button
                        onClick={() => checkSAHealthStatus(editingInvoice.id)}
                        disabled={checkingSAHealth}
                        className={`px-3 py-1 text-white text-sm rounded transition flex items-center gap-2 ${
                          checkingSAHealth
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        type="button"
                      >
                        {checkingSAHealth ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Checking...
                          </>
                        ) : (
                          'Check SA Health Status'
                        )}
                      </button>
                    )}
                  </div>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                    className="w-full border rounded px-3 py-2"
                    rows="3"
                    placeholder="Add any additional notes that are not parsed from the invoice..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Attachments</label>
                    <label className="cursor-pointer px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition">
                      {uploadingAttachment ? 'Uploading...' : 'Add File'}
                      <input
                        type="file"
                        onChange={handleAttachmentUpload}
                        className="hidden"
                        disabled={uploadingAttachment}
                      />
                    </label>
                  </div>
                  {attachments.length > 0 ? (
                    <div className="border rounded divide-y max-h-48 overflow-y-auto">
                      {attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{attachment.originalName}</p>
                                <p className="text-xs text-gray-500">
                                  {formatFileSize(attachment.fileSize)} • {new Date(attachment.uploadedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => window.open(`${BASE_URL}${attachment.filePath}`, '_blank')}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDeleteAttachment(attachment.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No attachments</p>
                  )}
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
                    onClick={() => {
                      setEditingInvoice(null);
                      setAttachments([]);
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
                <div className="flex gap-2">
                  {editingInvoice.pdfPath && (
                    <button
                      onClick={() => window.open(`${BASE_URL}${encodeURI(editingInvoice.pdfPath)}`, '_blank')}
                      className="px-4 py-2 bg-[#0076A2] text-white rounded hover:bg-[#005a7a] transition"
                    >
                      View PDF
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => deleteInvoice(editingInvoice.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                    >
                      Delete Invoice
                    </button>
                  )}
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
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const [currentView, setCurrentView] = useState('tracker'); // 'tracker' or 'analytics'
  const [showChatbot, setShowChatbot] = useState(false);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-xl font-bold text-gray-700">Loading...</div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Show authenticated app
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      {currentView === 'tracker' ? (
        <InvoiceTracker
          onNavigateToAnalytics={() => setCurrentView('analytics')}
          isAdmin={isAdmin}
        />
      ) : (
        <Analytics
          onNavigateBack={() => setCurrentView('tracker')}
        />
      )}

      {/* Floating AI Chatbot Button */}
      {!showChatbot && (
        <button
          onClick={() => setShowChatbot(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#0076A2',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0, 118, 162, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            transition: 'all 0.3s',
            zIndex: 9999
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = '#005A7D';
            e.target.style.transform = 'scale(1.1)';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = '#0076A2';
            e.target.style.transform = 'scale(1)';
          }}
          title="Open AI Assistant"
        >
          💬
        </button>
      )}

      {/* Chatbot Modal */}
      {showChatbot && <Chatbot onClose={() => setShowChatbot(false)} />}
    </div>
  );
}

export default App;
