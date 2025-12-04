# Invoice Tracker - User Guide

Version 2.1.0 - Updated 04 Dec 2024

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Invoice Management](#invoice-management)
4. [SA Health Invoice Status Check](#sa-health-invoice-status-check)
5. [Quick Edit - Services and Notes](#quick-edit---services-and-notes)
6. [Analytics Platform](#analytics-platform)
7. [Filtering and Searching](#filtering-and-searching)
8. [Duplicate Management](#duplicate-management)
9. [User Management](#user-management)
10. [Tips & Best Practices](#tips--best-practices)

---

## Getting Started

### Logging In

1. Navigate to the Invoice Tracker URL
2. Enter your email and password
3. Click "Sign In"

### User Roles

- **Admin**: Full access to all features, including user management and invoice deletion
- **User**: Can view, create, and edit invoices; cannot delete invoices or manage users

---

## Dashboard Overview

The main dashboard displays all invoices with key information:

- **Invoice Number**: Click to view full details
- **Pencil Icon** (next to invoice number): Quick access to view services and edit notes
- **Client**: Organization that issued the invoice
- **Contract Number**: Associated customer contract
- **Invoice Date**: Date the invoice was issued
- **Due Date**: Payment due date
- **Amount**: Invoice amount in original currency (with USD equivalent shown below)
- **Status**: Pending, Paid, or Overdue
- **Type**: Standard Invoice, Credit Memo, Vendor Invoice, or Purchase Order
- **Frequency**: One-time, Monthly, Quarterly, or Annually

### Color Coding

- **Status Colors**:
  - Green: Paid
  - Yellow: Pending
  - Red: Overdue

- **Type Colors**:
  - Blue: Standard Invoice
  - Purple: Credit Memo
  - Orange: Vendor Invoice
  - Teal: Purchase Order

---

## Invoice Management

### Uploading Invoices

1. Click **"Upload PDFs"** button
2. Select one or multiple PDF files
3. Click **"Upload and Process"**
4. System automatically extracts:
   - Invoice number
   - Client name
   - Invoice and due dates
   - Amount and currency
   - Services (if available)
   - Contract number (if present)

### Creating Manual Invoices

1. Click **"Create Invoice"** button
2. Fill in required fields:
   - Invoice Number (required)
   - Client (required)
   - Invoice Date (required)
   - Due Date
   - Amount and Currency
   - Status
   - Type
   - Frequency
3. Click **"Create Invoice"**

### Editing Invoices

1. Click on an invoice number to view details
2. Click **"Edit Invoice"** button
3. Modify any fields as needed
4. Update services or notes
5. Upload or delete attachments
6. Click **"Save Changes"**

### Deleting Invoices (Admin Only)

1. Open invoice details
2. Click **"Delete Invoice"** button (red)
3. Confirm deletion

---

## SA Health Invoice Status Check

**New Feature in v2.1.0**

For South Australia Health invoices, you can check the real-time payment status directly from the SA Health website.

### How to Use

1. Open an SA Health invoice for editing
2. Scroll to the **Notes** section
3. Click **"Check SA Health Status"** button
4. Wait 5-10 seconds (button will show spinning icon and "Checking..." text)
5. Status will be automatically added to invoice notes with:
   - Check date (dd-mmm-yyyy format)
   - Payment status (Paid/Unpaid)
   - Payment date (if paid)

### Example Note Format

```
SA Health Status (checked 04-Dec-2024): Paid on 15-Nov-2024
────────────────────────────────────────────────────────
Your internal notes here...
```

### Tips

- The button is disabled while checking to prevent duplicate requests
- Status checks can take up to 10 seconds - be patient!
- Previous SA Health status checks are preserved in notes
- Your internal notes below the separator line are never overwritten

---

## Quick Edit - Services and Notes

**New Feature in v2.1.0**

Quickly view extracted services and edit notes without opening the full invoice editor.

### How to Use

1. Click the **pencil icon** (✏️) next to any invoice number
2. Quick Edit Modal opens showing:
   - **Services**: Automatically extracted from invoice PDF
   - **Notes**: Editable text area for adding comments
3. Edit notes as needed
4. Click **"Save Notes"** to save changes
5. Click **"Cancel"** or click outside to close without saving

### When to Use Quick Edit

- **View services**: Quick reference to what's included in the invoice
- **Add quick notes**: Add comments without opening full edit mode
- **SA Health checks**: For SA Health invoices, notes include status checks

---

## Analytics Platform

Access comprehensive analytics by clicking **"Analytics"** button.

### Dashboard Metrics

**Phase 1: Core KPIs**
- Days Sales Outstanding (DSI)
- DSI Trend (last 6 months)
- Aging Trend Chart
- Top 10 Clients by Revenue
- Payment Velocity by Client
- Revenue by Type Over Time

**Phase 2: Financial Planning**
- Cash Flow Projection (30/60/90 days)
- Client Payment Scorecard (A-D grades)
- Collection Efficiency Metrics
- Contract Value vs Actual Invoiced
- Risk Dashboard

**Phase 3: Predictive Analytics**
- Payment Probability Predictions
- Revenue Forecasting (next 6 months)
- Seasonal Trend Analysis

### Production Mode

- **Enabled automatically after January 1, 2026**
- Shows only production data (from Jan 1, 2026 onwards)
- Pre-production data (Nov-Dec 2025) hidden in production mode
- Toggle available for testing before production date

### Aged Invoice Report - Client Filtering

**New Feature in v2.1.0**

Filter the Aged Invoice Report by specific clients to focus on problem accounts.

#### How to Use

1. Navigate to **Analytics** → Scroll to **Aged Invoice Report (Unpaid Only)**
2. Click **"Select Clients"** button
3. Client selection modal opens showing all clients with unpaid invoices
4. **Select clients**:
   - Click individual client names to select/deselect
   - Click **"Select All"** to choose all clients
   - Click **"Deselect All"** to clear all selections
5. Click **"Apply Filter"** to update the chart
6. Click **"Clear All Filters"** button (next to date filter) to reset

#### Features

- **Multi-select**: Choose multiple clients at once
- **Real-time filtering**: Chart updates immediately when you apply filters
- **Persistent selection**: Selected clients stay highlighted in the modal
- **Visual feedback**: Active filters shown with count (e.g., "Select Clients (3)")
- **Aging bucket clicks**: When you click an aging bucket (31-60 days, etc.), the client filter is respected

#### Use Cases

- Focus on specific high-risk clients
- Compare aging patterns between clients
- Track collection efforts for priority accounts
- Present aging data filtered by region or account manager

---

## Filtering and Searching

### Date Range Filter

1. Click **"Show Filters"** button
2. Select date range:
   - **This Month**: Current month invoices
   - **Last 30 Days**: Rolling 30-day window
   - **This Quarter**: Current calendar quarter
   - **This Year**: Current calendar year
   - **All Time**: All invoices
   - **Custom Range**: Pick specific start/end dates
3. Click **"Apply Filters"**

### Status Filter

- **All**: Show all invoices
- **Pending**: Unpaid invoices
- **Paid**: Paid invoices
- **Overdue**: Past due date and unpaid

### Client Filter

1. Click **"Show Filters"**
2. Use client dropdown to filter by specific client
3. Clear selection to show all clients

### Search

- Use the search box to find invoices by:
  - Invoice number
  - Client name
  - Contract number
  - Amount

### Sorting

Click column headers to sort by:
- Invoice Date (default: newest first)
- Due Date
- Amount
- Client
- Status
- Invoice Number

Click again to reverse sort order.

---

## Duplicate Management

The system automatically detects duplicate invoices based on:
- Same invoice number
- Same client name
- Same invoice date

### Viewing Duplicates

1. Click **"View Duplicates"** button
2. See list of duplicate invoice sets
3. Shows count and basic info for each duplicate group

### Managing Duplicates

1. Click **"View Details"** for a duplicate set
2. Review all instances of the duplicate
3. Options:
   - **Delete Duplicates**: Keeps most recent, removes others
   - **Delete Individual**: Click "Delete" button on specific row to remove that instance only
   - **Keep All**: If duplicates are legitimate (e.g., split payments)

### Individual Duplicate Deletion

**New Feature in v2.1.0**

- Each duplicate row has its own **"Delete"** button
- Choose exactly which duplicate to keep/remove
- Available to all authenticated users (not admin-only)
- Use when you need granular control over which invoice version to keep

---

## User Management

**Admin Only**

### Creating Users

1. Click your profile icon (top right)
2. Select **"Manage Users"**
3. Click **"Create New User"**
4. Fill in details:
   - Email (required, unique)
   - Password (required, min 8 characters)
   - First Name
   - Last Name
   - Role (Admin or User)
5. Click **"Create User"**

### Editing Users

1. In User Management, find the user
2. Click **"Edit"** button
3. Modify details (leave password blank to keep unchanged)
4. Click **"Save"**

### Deleting Users

1. In User Management, find the user
2. Click **"Delete"** button
3. Confirm deletion

### Changing Your Password

1. Click your profile icon (top right)
2. Select **"Change Password"**
3. Enter current password
4. Enter new password (min 8 characters)
5. Confirm new password
6. Click **"Change Password"**

---

## Tips & Best Practices

### Invoice Management

✅ **Upload PDFs regularly** - Automatic extraction saves time
✅ **Review extracted data** - PDF parsing is accurate but verify important details
✅ **Use notes field** - Add context that isn't in the PDF
✅ **Attach supporting documents** - Upload related files for reference
✅ **Check for duplicates** - Review duplicate alerts promptly

### SA Health Invoice Tracking

✅ **Check status before follow-up** - Verify payment status online first
✅ **Be patient** - Status checks take 5-10 seconds
✅ **Document checks** - Status is automatically saved to notes
✅ **Review historical checks** - Previous check results are preserved

### Quick Edit Usage

✅ **Use for quick tasks** - View services or add brief notes
✅ **Use full edit for complex changes** - Use Edit Invoice for status, dates, amounts
✅ **Quick reference** - Click pencil icon to quickly check what services are included

### Analytics Usage

✅ **Use client filters** - Focus aging reports on problem accounts
✅ **Review DSI regularly** - Monitor collection performance trends
✅ **Check cash flow projection** - Plan for upcoming cash needs
✅ **Monitor payment velocity** - Identify slow-paying clients early
✅ **Use payment probability** - Prioritize collection efforts
✅ **Filter aging by client** - Deep dive into specific account aging

### Filtering & Search

✅ **Use date filters** - Focus on relevant time periods
✅ **Combine filters** - Use status + client + date for precise results
✅ **Sort strategically** - Sort by due date to prioritize overdue invoices
✅ **Search by contract** - Find all invoices for a specific contract

### Duplicate Management

✅ **Review duplicates weekly** - Keep database clean
✅ **Investigate before deleting** - Some duplicates may be legitimate (split payments, corrections)
✅ **Use individual delete** - When you need to keep a specific version
✅ **Keep audit trail** - Duplicates may indicate process issues

### Data Quality

✅ **Standardize client names** - Consistent naming improves reporting
✅ **Update invoice types** - Correct categorization for accurate analytics
✅ **Fill in contract numbers** - Links invoices to contracts for tracking
✅ **Verify currencies** - Ensure correct currency codes (USD, AUD, EUR, etc.)

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Close modal | `Esc` |
| Search | Click search box |
| Submit form | `Enter` (when in input field) |

---

## Troubleshooting

### PDF Upload Issues

**Problem**: PDF not uploading
**Solutions**:
- Check file size (max 10MB)
- Ensure file is actually a PDF
- Try uploading one at a time
- Check server is running

**Problem**: Data not extracted correctly
**Solutions**:
- Review invoice format (system works best with standard layouts)
- Manually edit extracted data
- Report parsing issues to admin

### SA Health Status Check

**Problem**: "Checking..." takes too long
**Solutions**:
- Wait full 10 seconds before retrying
- Check internet connection
- Verify SA Health website is accessible
- Try again after a few minutes

**Problem**: Status not found
**Solutions**:
- Verify invoice number is correct
- Confirm invoice is actually from SA Health
- Check if invoice is recent (very old invoices may not be in system)

### Quick Edit Issues

**Problem**: Services not showing
**Solutions**:
- Services only show if extracted from PDF
- Not all PDFs have extractable service information
- Use full edit mode to add services manually

**Problem**: Notes not saving
**Solutions**:
- Click "Save Notes" button (not just closing modal)
- Check for error messages
- Verify you have permission to edit

### Analytics Issues

**Problem**: Client filter not working
**Solutions**:
- Ensure you clicked "Apply Filter" button
- Try clicking "Clear All Filters" and reselecting
- Refresh the page

**Problem**: Data looks incorrect
**Solutions**:
- Check date filter (may be filtering out expected data)
- Verify production mode setting (hides pre-2026 data when enabled)
- Check if filters are applied

---

## Feature Version History

### Version 2.1.0 (04 Dec 2024)

**New Features**:
- ✅ SA Health invoice status check with real-time scraping
- ✅ Quick Edit modal for viewing services and editing notes
- ✅ Multi-client selection filter for Aged Invoice Report
- ✅ Individual duplicate deletion (choose which duplicate to delete)
- ✅ Improved loading feedback for SA Health checks
- ✅ Date format standardization (dd-mmm-yyyy)

**Improvements**:
- ✅ Better visual feedback during long operations
- ✅ Enhanced client filtering with select all/deselect all
- ✅ Aging bucket clicks respect client filter selection
- ✅ Services display fixed in Quick Edit modal

### Version 2.0.0 (02 Dec 2024)

**Major Updates**:
- ✅ PostgreSQL database migration
- ✅ Advanced analytics platform (Phase 1-3)
- ✅ User authentication and role-based access
- ✅ Production mode for go-live management
- ✅ Comprehensive duplicate detection
- ✅ Attachment management
- ✅ Enhanced PDF parsing

---

## Support & Feedback

For issues, questions, or feature requests:

1. Check this user guide
2. Review the troubleshooting section
3. Contact your system administrator
4. Check the technical documentation in `/docs` folder

---

**Last Updated**: 04 Dec 2024
**Version**: 2.1.0
**For**: Invoice Tracker - APAC Region
