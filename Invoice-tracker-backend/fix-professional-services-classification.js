const { db } = require('./db-postgres.js');

// This is the UPDATED classification function with PS checked BEFORE MS
function classifyInvoiceType(services, invoice_number, amount) {
  // Check if amount is negative - credit memos have negative amounts
  if (amount && amount < 0) {
    return 'Credit Memo';
  }

  if (!services) return 'PS';

  const lower = services.toLowerCase();

  // Check in order of specificity
  if (lower.includes('credit') || lower.includes('negative')) return 'Credit Memo';

  // Professional Services - check FIRST to catch explicit PS mentions even if "managed" appears elsewhere
  // Check for professionalservice* (catches professionalservices, professionalservicestotal, etc)
  if (lower.includes('consulting') ||
      lower.includes('professional services') ||
      lower.includes('professionalservice') ||  // catches professionalservices, professionalservicestotal, etc
      lower.includes('professional service fee') ||
      lower.includes('professionalservicesfee') ||
      lower.includes('penetration testing')) return 'PS';

  // Check for Managed Services - handle various formats (check AFTER professional services)
  // Pattern: "subscription" + "managed" = MS, not Sub
  if (lower.includes('managed services') ||
      lower.includes('managed/outsourcing services') ||
      (lower.includes('managed') && lower.includes('outsourcing')) ||
      (lower.includes('subscription') && lower.includes('managed'))) {
    return 'MS';
  }

  // Maintenance and Support - exclude if it's actually a subscription
  // More specific checks to avoid catching "support" in other contexts
  if ((lower.includes('maintenance') ||
       lower.includes('annual maintenance') ||
       lower.includes('software support') ||
       lower.includes('support services') ||
       lower.includes('support fee') ||
       lower.includes('license maintenance')) &&
      !lower.includes('managed') &&
      !lower.includes('professional') &&
      !lower.includes('subscription')) {  // Exclude subscriptions (e.g., "Year Subscription Fee for Software Support Services")
    return 'Maint';
  }

  // Software licenses (ad-hoc) - check BEFORE subscription
  // If it has "license/licence" with software-related terms but NO subscription indicators, it's SW
  if ((lower.includes('license') || lower.includes('licence')) &&
      !lower.includes('subscription') &&
      !lower.includes('annual') &&
      !lower.includes('yearly') &&
      !lower.includes('recurring')) {
    // Ad-hoc licenses are typically software purchases
    if (lower.includes('software') ||
        lower.includes('connectivity') ||
        lower.includes('single') ||
        lower.includes('perpetual') ||
        lower.includes('one-time')) {
      return 'SW';
    }
    // Default ad-hoc licenses to SW unless proven otherwise
    return 'SW';
  }

  // Subscription - only if NOT managed services or maintenance
  // Now only catches explicit subscriptions with recurring patterns
  if (lower.includes('subscription') ||
      (lower.includes('license') && (lower.includes('annual') || lower.includes('yearly'))) ||
      lower.includes('saas')) return 'Sub';

  if (lower.includes('hosting') || lower.includes('cloud services') || lower.includes('infrastructure')) return 'Hosting';
  if (lower.includes('software') || lower.includes('application') || lower.includes('program')) return 'SW';
  if (lower.includes('hardware') || lower.includes('equipment') || lower.includes('devices')) return 'HW';
  if (lower.includes('third party')) return '3PP';

  return 'PS';
}

async function reclassifyProfessionalServices() {
  try {
    // Get all invoices
    const invoices = await db.all('SELECT * FROM invoices');
    console.log(`Total invoices in database: ${invoices.length}`);

    let reclassified = 0;
    const updates = [];

    // Check each invoice with the updated logic
    for (const invoice of invoices) {
      const currentType = invoice.invoiceType;
      const newType = classifyInvoiceType(invoice.services, invoice.invoiceNumber, invoice.amountDue);

      if (currentType !== newType) {
        console.log(`\nInvoice: ${invoice.invoiceNumber}`);
        console.log(`  Current: ${currentType} → New: ${newType}`);
        console.log(`  Services: ${invoice.services?.substring(0, 100)}...`);

        updates.push({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          oldType: currentType,
          newType: newType
        });
        reclassified++;
      }
    }

    console.log(`\n\n========================================`);
    console.log(`Found ${reclassified} invoices that need reclassification`);
    console.log(`========================================\n`);

    if (updates.length === 0) {
      console.log('No updates needed. All invoices are correctly classified.');
      await db.close();
      return;
    }

    // Show summary
    console.log('Summary of changes:');
    updates.forEach(u => {
      console.log(`  ${u.invoiceNumber}: ${u.oldType} → ${u.newType}`);
    });

    console.log('\n\nApplying updates...\n');

    // Apply updates
    for (const update of updates) {
      await db.run(
        'UPDATE invoices SET invoice_type = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [update.newType, update.id]
      );
      console.log(`✓ Updated ${update.invoiceNumber}: ${update.oldType} → ${update.newType}`);
    }

    console.log(`\n✅ Successfully reclassified ${reclassified} invoice(s)`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

// Run the reclassification
console.log('Starting Professional Services reclassification...\n');
reclassifyProfessionalServices();
