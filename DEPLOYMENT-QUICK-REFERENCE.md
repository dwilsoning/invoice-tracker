# Invoice Tracker - Deployment Quick Reference

One-page reference for deploying Invoice Tracker to the cloud.

## Choose Your Platform

- **AWS EC2**: See [DEPLOYMENT-GUIDE-AWS.md](DEPLOYMENT-GUIDE-AWS.md)
- **Microsoft Azure**: See [DEPLOYMENT-GUIDE-AZURE.md](DEPLOYMENT-GUIDE-AZURE.md)

This guide focuses on AWS EC2 deployment. For Azure, refer to the Azure deployment guide.

---

## AWS EC2 Deployment

## Prerequisites

✅ AWS account with billing
✅ Domain name (optional)
✅ Local data backed up
✅ 4-6 hours available

---

## Phase 1: Local Preparation (30 mins)

### 1. Export Your Data
```bash
cd Invoice-tracker-backend
node scripts/migrate-to-aws.js --export
```
**Output:** `invoice-tracker-data-[timestamp].tar.gz`

### 2. Note File Size
```bash
ls -lh invoice-tracker-data-*.tar.gz
```

---

## Phase 2: AWS Setup (30 mins)

### 1. Launch EC2 Instance
- **Console:** AWS → EC2 → Launch Instance
- **Name:** invoice-tracker-prod
- **AMI:** Ubuntu Server 22.04 LTS
- **Type:** t3.small (2 vCPU, 2 GB RAM)
- **Storage:** 30 GB gp3
- **Key:** Create new, download `.pem`

### 2. Configure Security Group
```
SSH (22)     → Your IP
HTTP (80)    → 0.0.0.0/0
HTTPS (443)  → 0.0.0.0/0
```

### 3. Launch & Note Public IP
**Public IP:** `__.__.__.__`

---

## Phase 3: Connect to EC2 (5 mins)

### Windows
```powershell
# Convert .pem to .ppk using PuTTYgen
# Open PuTTY: ubuntu@<PUBLIC-IP>
```

### Linux/Mac/WSL
```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@<PUBLIC-IP>
```

---

## Phase 4: Transfer Data (30-120 mins)

### From Local Machine
```bash
scp -i your-key.pem invoice-tracker-data-*.tar.gz ubuntu@<PUBLIC-IP>:~/
```

**Estimates:**
- 100 MB: 5-10 minutes
- 1 GB: 30-60 minutes
- 10 GB+: several hours

---

## Phase 5: Automated Deployment (45 mins)

### On EC2 Instance
```bash
# Clone repo
git clone https://github.com/your-username/invoice-tracker.git
cd invoice-tracker

# Run deployment script
bash scripts/deploy-to-ec2.sh
```

**Script will prompt for:**
- PostgreSQL password
- GitHub repo URL
- Admin email/password
- Domain names

---

## Phase 6: Import Data (30 mins)

```bash
node scripts/migrate-to-aws.js --import --file ~/invoice-tracker-data-*.tar.gz
```

---

## Phase 7: DNS Configuration (15 mins)

### Point Your Domain
**Add A Records:**
```
yourdomain.com     → <EC2-PUBLIC-IP>
www.yourdomain.com → <EC2-PUBLIC-IP>
api.yourdomain.com → <EC2-PUBLIC-IP>
```

**Wait:** 5 mins - 48 hours for propagation

---

## Phase 8: SSL Setup (15 mins)

### Let's Encrypt (Already done if you chose 'y' during deployment)
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

---

## Phase 9: Testing (30 mins)

### Access Application
```
https://yourdomain.com
```

### Test Checklist
- [ ] Login works
- [ ] Historical data present
- [ ] Upload invoice
- [ ] View PDFs
- [ ] Generate reports
- [ ] User management
- [ ] No console errors

---

## Useful Commands

### Backend Management
```bash
pm2 status                    # Check status
pm2 logs invoice-tracker-api  # View logs
pm2 restart invoice-tracker-api  # Restart
pm2 stop invoice-tracker-api    # Stop
pm2 start invoice-tracker-api   # Start
```

### Nginx
```bash
sudo systemctl status nginx   # Check status
sudo systemctl restart nginx  # Restart
sudo nginx -t                 # Test config
sudo tail -f /var/log/nginx/error.log  # View errors
```

### Database
```bash
psql -U invoice_tracker_user -d invoice_tracker  # Connect
sudo systemctl status postgresql  # Check status
sudo systemctl restart postgresql  # Restart
```

### System
```bash
df -h                # Disk space
free -h              # Memory
htop                 # Process monitor
sudo ufw status      # Firewall status
```

### Backups
```bash
ls -lh ~/backups/           # View backups
~/backup-invoice-tracker.sh # Manual backup
```

---

## Troubleshooting

### Backend Not Working
```bash
pm2 logs invoice-tracker-api  # Check logs
pm2 restart invoice-tracker-api  # Restart
```

### Frontend Not Loading
```bash
sudo systemctl restart nginx
sudo tail -f /var/log/nginx/error.log
```

### Database Connection Failed
```bash
sudo systemctl restart postgresql
psql -U invoice_tracker_user -d invoice_tracker  # Test connection
```

### Can't Access Website
```bash
# Check DNS
nslookup yourdomain.com

# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check firewall
sudo ufw status
```

---

## Emergency Rollback

### Stop Application
```bash
pm2 stop invoice-tracker-api
```

### Restore Database
```bash
gunzip -c ~/backups/db-YYYY-MM-DD.sql.gz | psql -U invoice_tracker_user -d invoice_tracker
```

### Restore Files
```bash
tar -xzf ~/backups/files-YYYY-MM-DD.tar.gz -C ~/invoice-tracker/Invoice-tracker-backend/
```

### Restart
```bash
pm2 restart invoice-tracker-api
```

---

## Important Files

### Configuration
```
~/invoice-tracker/Invoice-tracker-backend/.env
/etc/nginx/sites-available/invoice-tracker
```

### Logs
```
~/.pm2/logs/invoice-tracker-api-out.log
~/.pm2/logs/invoice-tracker-api-error.log
/var/log/nginx/access.log
/var/log/nginx/error.log
```

### Backups
```
~/backups/db-*.sql.gz
~/backups/files-*.tar.gz
```

---

## Cost Monitoring

### Monthly Estimates
- EC2 t3.small: $15-20
- Data transfer: $5-10
- Storage: $3-5
- **Total: ~$25-35/month**

### Check Costs
- AWS Console → Billing Dashboard
- Set up cost alerts

---

## Security Checklist

- [ ] Strong passwords everywhere
- [ ] Firewall (UFW) enabled
- [ ] Fail2ban installed
- [ ] SSL certificate active
- [ ] Database not exposed
- [ ] .env file secured
- [ ] Regular backups running
- [ ] Updates scheduled

---

## Support Resources

### Documentation
- Full Guide: `AWS-EC2-DEPLOYMENT-GUIDE.md`
- Checklist: `PRE-DEPLOYMENT-CHECKLIST.md`
- Tech Stack: `DEPENDENCIES-AND-TECH-STACK.md`

### AWS Help
- [EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [AWS Support](https://aws.amazon.com/support/)

### Tools
- [PM2 Docs](https://pm2.keymetrics.io/)
- [Nginx Docs](https://nginx.org/en/docs/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

## Success! 🎉

Your Invoice Tracker is now running on AWS EC2!

**Access:** https://yourdomain.com
**Admin:** Your email/password

**Next:**
1. Test thoroughly
2. Train users
3. Monitor logs
4. Set up monitoring
5. Document any customizations

---

**Questions?** Check the full deployment guide or AWS documentation.
