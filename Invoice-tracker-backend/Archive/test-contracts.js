const db = require('./db-postgres.js');

// Simulate the query logic
db.pool.query('SELECT * FROM invoices', (err, allInvoices) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }

  const results = allInvoices.rows;
  console.log('Total invoices:', results.length);

  // Get unique contract names from invoices
  const uniqueContractNames = [...new Set(results
    .map(inv => inv.customer_contract)
    .filter(name => name))];

  console.log('Unique contract names in invoices:', uniqueContractNames.length);

  // Get all contracts from contracts table
  db.pool.query('SELECT * FROM contracts', (err2, allContracts) => {
    if (err2) {
      console.error('Error:', err2);
      process.exit(1);
    }

    const contracts = allContracts.rows;
    console.log('Contracts in table:', contracts.length);

    // Find contracts with no value
    const contractsWithNoValue = uniqueContractNames.filter(contractName => {
      const contractRecord = contracts.find(c => c.contract_name === contractName);
      return !contractRecord || !contractRecord.contract_value || contractRecord.contract_value === 0;
    });

    console.log('Contracts with no value:', contractsWithNoValue.length);
    console.log('First 10:', contractsWithNoValue.slice(0, 10));
    console.log('Includes 461327?', contractsWithNoValue.includes('461327'));

    // Filter invoices to those contracts
    const filteredInvoices = results.filter(inv => {
      const contractName = inv.customer_contract;
      return contractName && contractsWithNoValue.includes(contractName);
    });

    console.log('Filtered invoices:', filteredInvoices.length);

    db.pool.end();
  });
});
