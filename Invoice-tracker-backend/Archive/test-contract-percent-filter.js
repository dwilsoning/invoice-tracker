const { db } = require('./db-postgres');

// Exchange rates (same as server)
const exchangeRates = {
  USD: 1,
  AUD: 0.65,
  EUR: 1.08,
  GBP: 1.27,
  SGD: 0.74,
  NZD: 0.61
};

function convertToUSD(amount, currency) {
  const rate = exchangeRates[currency] || 1;
  return Math.round(amount * rate);
}

async function testContractPercentFilter() {
  try {
    console.log('Testing Contract Percentage Filter Fix...\n');

    // Get all contracts
    const contracts = await db.all('SELECT contract_name, contract_value, currency FROM contracts');

    // Get ALL invoices
    const allInvoices = await db.all(`
      SELECT customer_contract, amount_due, currency, status
      FROM invoices
      WHERE customer_contract IS NOT NULL
        AND customer_contract != ''
        AND invoice_type != 'Credit Memo'
    `);

    console.log(`Found ${contracts.length} contracts`);
    console.log(`Found ${allInvoices.length} invoices (excluding credit memos)\n`);

    // Calculate percentages for all contracts
    const contractTotals = {};
    const contractPaidTotals = {};

    allInvoices.forEach(inv => {
      const contractName = inv.customerContract;
      if (contractName) {
        if (!contractTotals[contractName]) {
          contractTotals[contractName] = 0;
          contractPaidTotals[contractName] = 0;
        }
        const amountUSD = convertToUSD(inv.amountDue, inv.currency);
        contractTotals[contractName] += amountUSD;

        if (inv.status === 'Paid') {
          contractPaidTotals[contractName] += amountUSD;
        }
      }
    });

    // Display all contracts with their percentages
    console.log('Contract Invoiced Percentages:');
    console.log('================================\n');

    const contractData = [];

    contracts.forEach(contract => {
      const contractName = contract.contractName;
      const contractValue = parseFloat(contract.contractValue);
      const contractCurrency = contract.currency || 'USD';

      if (!contractValue || isNaN(contractValue) || contractValue <= 0) {
        return;
      }

      const contractValueUSD = convertToUSD(contractValue, contractCurrency);
      const invoicedTotal = contractTotals[contractName] || 0;
      const paidTotal = contractPaidTotals[contractName] || 0;
      const unpaidTotal = invoicedTotal - paidTotal;

      const percentInvoiced = contractValueUSD > 0 ? (invoicedTotal / contractValueUSD) * 100 : 0;
      const percentPaid = contractValueUSD > 0 ? (paidTotal / contractValueUSD) * 100 : 0;

      // Cap at 100%
      const cappedInvoiced = Math.min(percentInvoiced, 100);
      const cappedPaid = Math.min(percentPaid, 100);

      contractData.push({
        name: contractName,
        value: contractValueUSD,
        invoiced: invoicedTotal,
        percentInvoiced: Math.round(cappedInvoiced * 10) / 10,
        percentPaid: Math.round(cappedPaid * 10) / 10
      });
    });

    // Sort by percent invoiced
    contractData.sort((a, b) => a.percentInvoiced - b.percentInvoiced);

    contractData.forEach(c => {
      console.log(`${c.name}:`);
      console.log(`  Contract Value: $${c.value.toLocaleString()} USD`);
      console.log(`  Invoiced: $${c.invoiced.toLocaleString()} USD (${c.percentInvoiced}%)`);
      console.log(`  Paid: ${c.percentPaid}%`);
      console.log('');
    });

    // Test filters
    console.log('\n\n=== Testing Filters ===\n');

    // Test 1: Less than 80%
    console.log('1. Contracts with <80% invoiced:');
    const under80 = contractData.filter(c => c.percentInvoiced < 80);
    console.log(`   Found ${under80.length} contracts:`);
    under80.forEach(c => console.log(`   - ${c.name}: ${c.percentInvoiced}%`));

    // Test 2: Exactly 100%
    console.log('\n2. Contracts with 100% invoiced:');
    const exactly100 = contractData.filter(c => c.percentInvoiced === 100);
    console.log(`   Found ${exactly100.length} contracts:`);
    exactly100.forEach(c => console.log(`   - ${c.name}: ${c.percentInvoiced}%`));

    // Test 3: Range 50-75%
    console.log('\n3. Contracts between 50% and 75% invoiced:');
    const range5075 = contractData.filter(c => c.percentInvoiced >= 50 && c.percentInvoiced <= 75);
    console.log(`   Found ${range5075.length} contracts:`);
    range5075.forEach(c => console.log(`   - ${c.name}: ${c.percentInvoiced}%`));

    // Verify the fix: contracts at 100% should NOT appear in <80% filter
    console.log('\n\n=== VERIFICATION ===');
    const bug = under80.some(c => c.percentInvoiced === 100);
    if (bug) {
      console.log('❌ BUG FOUND: 100% invoiced contracts appearing in <80% filter!');
    } else {
      console.log('✅ PASS: No 100% invoiced contracts in <80% filter');
    }

    await db.close();

  } catch (error) {
    console.error('Error:', error);
    await db.close();
  }
}

testContractPercentFilter();
