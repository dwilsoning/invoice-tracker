# Invoice Tracker - Pre-Deployment Checklist

Complete this checklist before deploying to AWS EC2 to ensure a smooth migration.

## ☐ 1. Local Environment Preparation

### Data Backup
- [ ] Create full database backup
- [ ] Verify all invoice PDFs are present
- [ ] Check all uploaded files are accessible
- [ ] Document current database size
- [ ] Document total file storage size

### Testing
- [ ] All features working locally
- [ ] Login/authentication functional
- [ ] Invoice upload working
- [ ] PDF parsing successful
- [ ] Reports generating correctly
- [ ] User management working
- [ ] No console errors in browser

### Code Quality
- [ ] Latest code committed to Git
- [ ] All changes pushed to GitHub
- [ ] No sensitive data in repository
- [ ] .env.example file updated
- [ ] README.md is current

---

## ☐ 2. AWS Account Setup

### AWS Prerequisites
- [ ] AWS account created and verified
- [ ] Payment method added
- [ ] IAM user created with appropriate permissions
- [ ] AWS CLI installed locally
- [ ] AWS CLI configured with credentials
- [ ] Region selected (e.g., us-east-1)

### Billing
- [ ] Billing alerts configured
- [ ] Budget set up
- [ ] Cost estimate reviewed
- [ ] Understand monthly costs (~$40-60/month)

---

## ☐ 3. Domain & DNS

### Domain Setup (Optional but Recommended)
- [ ] Domain name purchased/available
- [ ] DNS provider accessible
- [ ] Know your domain registrar login
- [ ] Plan domain structure:
  - [ ] Main app: yourdomain.com
  - [ ] API: api.yourdomain.com
  - [ ] (Optional) Admin: admin.yourdomain.com

### SSL Certificate
- [ ] Email address for Let's Encrypt notifications
- [ ] Understand SSL renewal process
- [ ] OR AWS Certificate Manager configured

---

## ☐ 4. EC2 Instance Planning

### Instance Configuration
- [ ] Instance type selected (recommend t3.small minimum)
- [ ] AMI chosen (Ubuntu Server 22.04 LTS)
- [ ] Storage size determined (30+ GB)
- [ ] Region selected (close to users)

### Security
- [ ] Strong key pair created
- [ ] Key pair downloaded and saved securely
- [ ] Key pair backed up
- [ ] Security group rules planned:
  - [ ] SSH (22) - Your IP only
  - [ ] HTTP (80) - 0.0.0.0/0
  - [ ] HTTPS (443) - 0.0.0.0/0
  - [ ] PostgreSQL (5432) - localhost only

---

## ☐ 5. Database Preparation

### Local Database
- [ ] Database running and accessible
- [ ] Connection credentials documented
- [ ] Database size documented (for migration time estimate)
- [ ] All migrations applied
- [ ] Test data cleaned up (optional)

### Backup
- [ ] Recent backup created
- [ ] Backup file tested (can restore)
- [ ] Backup file size reasonable for transfer

---

## ☐ 6. Credentials & Secrets

### Document/Prepare
- [ ] Database passwords chosen (strong!)
- [ ] JWT secret generated (use provided command)
- [ ] Admin user credentials chosen
- [ ] All passwords stored securely (password manager)
- [ ] GitHub personal access token (if private repo)

### Security Best Practices
- [ ] Passwords are 16+ characters
- [ ] Passwords include special characters
- [ ] Different passwords for each service
- [ ] Passwords not reused from other systems

---

## ☐ 7. Migration Data Preparation

### Export Data
- [ ] Run migration export script
- [ ] Verify export completed successfully
- [ ] Check export file size
- [ ] Test extract export file locally
- [ ] Calculate transfer time estimate:
  - 100 MB = ~5-10 minutes
  - 1 GB = ~30-60 minutes
  - 10 GB+ = several hours

### File Organization
- [ ] All PDFs organized properly
- [ ] No temporary files included
- [ ] File permissions correct
- [ ] No corrupted files

---

## ☐ 8. Network & Access

### Local Machine
- [ ] SSH client installed (PuTTY for Windows, or native)
- [ ] Internet connection stable
- [ ] VPN disabled (or configured for AWS access)
- [ ] Firewall allows outbound SSH

### Remote Access
- [ ] Know your public IP address
- [ ] Can access AWS Console
- [ ] Can SSH to test instance

---

## ☐ 9. Time & Resources

### Schedule
- [ ] 4-6 hours blocked for deployment
- [ ] Off-peak hours chosen (less user impact)
- [ ] Team members notified
- [ ] Backup person available
- [ ] No conflicting meetings/commitments

### Downtime Planning
- [ ] Users notified of maintenance window
- [ ] Maintenance page prepared (optional)
- [ ] Rollback plan documented
- [ ] Support plan for post-deployment

---

## ☐ 10. Documentation Ready

### Have Available
- [ ] AWS-EC2-DEPLOYMENT-GUIDE.md printed/accessible
- [ ] Migration script (migrate-to-aws.js) reviewed
- [ ] Deployment script (deploy-to-ec2.sh) reviewed
- [ ] Database credentials handy
- [ ] Domain registrar login info
- [ ] AWS console login ready

---

## ☐ 11. Tools & Software

### Local Machine
- [ ] Node.js installed (18.x)
- [ ] PostgreSQL client tools (pg_dump, psql)
- [ ] Git installed
- [ ] SSH client working
- [ ] Text editor available
- [ ] SCP/SFTP client (for file transfer)

### Optional Tools
- [ ] Postman (for API testing)
- [ ] DB client (DBeaver/pgAdmin)
- [ ] AWS CLI installed

---

## ☐ 12. Testing Plan

### Pre-Deployment Testing
- [ ] Test migration script locally
- [ ] Verify export/import works
- [ ] Test database restoration
- [ ] Validate all files accessible

### Post-Deployment Testing
- [ ] Login works
- [ ] Invoice upload works
- [ ] PDF viewing works
- [ ] User management works
- [ ] Reports generate
- [ ] Email notifications (if configured)
- [ ] All API endpoints responsive

---

## ☐ 13. Communication Plan

### Stakeholders
- [ ] Team notified of deployment schedule
- [ ] Users notified of potential downtime
- [ ] Manager/supervisor informed
- [ ] Contact list prepared for issues

### Post-Deployment
- [ ] Success announcement prepared
- [ ] Known issues documented
- [ ] Support plan communicated

---

## ☐ 14. Rollback Plan

### Backup Strategy
- [ ] Current system still available
- [ ] Can revert DNS quickly
- [ ] Local backup available
- [ ] Understand rollback procedure
- [ ] Estimated rollback time known

---

## ☐ 15. Monitoring & Support

### Post-Deployment
- [ ] Monitoring tool selected (CloudWatch, etc.)
- [ ] Log access configured
- [ ] Error alerting set up
- [ ] Performance baseline established
- [ ] Support process defined

---

## ☐ 16. Final Checks

### Just Before Deployment
- [ ] All checklist items above completed
- [ ] Well-rested and focused
- [ ] Backup person available
- [ ] AWS account accessible
- [ ] No urgent work pending
- [ ] Clear mind and ready to troubleshoot

### During Deployment
- [ ] Follow guide step-by-step
- [ ] Take notes of any issues
- [ ] Don't skip verification steps
- [ ] Test after each major step
- [ ] Document any deviations from guide

---

## Quick Reference Commands

### Export Data (Local Machine)
```bash
cd Invoice-tracker-backend
node scripts/migrate-to-aws.js --export
```

### Transfer to EC2
```bash
scp -i your-key.pem invoice-tracker-data-*.tar.gz ubuntu@<EC2-IP>:~/
```

### Deploy on EC2
```bash
bash scripts/deploy-to-ec2.sh
```

### Import Data on EC2
```bash
node scripts/migrate-to-aws.js --import --file invoice-tracker-data-*.tar.gz
```

---

## Emergency Contacts

**Document these before starting:**

- AWS Support: _________________
- Domain Registrar: _________________
- Team Lead: _________________
- Database Admin: _________________
- Network Admin: _________________

---

## Success Criteria

### Deployment is successful when:
- [ ] Application accessible via domain
- [ ] Can login with admin credentials
- [ ] All historical data present
- [ ] PDFs viewable
- [ ] New invoices can be uploaded
- [ ] Reports work correctly
- [ ] SSL certificate active
- [ ] Backups configured and working
- [ ] No errors in logs
- [ ] Performance acceptable

---

## Post-Deployment Tasks

### Within 24 Hours
- [ ] Monitor logs continuously
- [ ] Watch for errors
- [ ] Check user feedback
- [ ] Verify backups running
- [ ] Test all major features
- [ ] Document any issues

### Within 1 Week
- [ ] Review performance metrics
- [ ] Optimize if needed
- [ ] Update documentation
- [ ] Train users on any changes
- [ ] Celebrate success! 🎉

---

**Ready to Deploy?**

If all items are checked, you're ready to proceed with deployment!

Refer to: `AWS-EC2-DEPLOYMENT-GUIDE.md` for detailed step-by-step instructions.

Good luck! 🚀
