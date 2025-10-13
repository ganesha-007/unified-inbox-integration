# 🚀 Deployment Checklist

## Pre-Deployment Setup

### ✅ Prerequisites
- [ ] Node.js (v16+) installed
- [ ] PostgreSQL installed and running
- [ ] Git installed
- [ ] UniPile account created
- [ ] WhatsApp Business account verified

### ✅ Environment Configuration
- [ ] Clone repository
- [ ] Run setup script: `./setup.sh`
- [ ] Edit `backend/.env` with your credentials:
  - [ ] `UNIPILE_API_KEY`
  - [ ] `WHATSAPP_ACCOUNT_NUMBER`
  - [ ] `WHATSAPP_ACCOUNT_TOKEN`
  - [ ] `DB_PASSWORD`

### ✅ Database Setup
- [ ] PostgreSQL service running
- [ ] Database `unified_inbox` created
- [ ] Database migrations completed

## Local Development

### ✅ Backend Setup
- [ ] Navigate to backend: `cd backend`
- [ ] Install dependencies: `npm install`
- [ ] Start server: `node server-working.js`
- [ ] Verify health check: `curl http://localhost:5001/health`

### ✅ Frontend Setup
- [ ] Navigate to frontend: `cd client`
- [ ] Install dependencies: `npm install`
- [ ] Start application: `npm start`
- [ ] Access application: `http://localhost:3001`

### ✅ Testing
- [ ] Send test message from interface
- [ ] Receive test message from WhatsApp
- [ ] Verify real-time updates work
- [ ] Test reply functionality
- [ ] Check message persistence

## Production Deployment

### ✅ Server Setup
- [ ] Production server configured
- [ ] Domain name configured
- [ ] SSL certificate installed
- [ ] Firewall rules configured

### ✅ Application Deployment
- [ ] Code deployed to production server
- [ ] Environment variables configured
- [ ] Database connection established
- [ ] Application started successfully

### ✅ Webhook Configuration
- [ ] UniPile webhook URL updated
- [ ] Webhook events enabled
- [ ] Webhook testing completed
- [ ] SSL certificate valid for webhooks

### ✅ Monitoring
- [ ] Application monitoring setup
- [ ] Error logging configured
- [ ] Performance monitoring enabled
- [ ] Backup procedures in place

## Post-Deployment

### ✅ Verification
- [ ] Application accessible via domain
- [ ] WhatsApp messages received
- [ ] Messages sent successfully
- [ ] Real-time updates working
- [ ] All features functional

### ✅ User Training
- [ ] User guide provided
- [ ] Team training completed
- [ ] Support procedures established
- [ ] Documentation accessible

---

## 🆘 Troubleshooting

### Common Issues
- **Port conflicts**: Kill existing processes
- **Database errors**: Check PostgreSQL status
- **API errors**: Verify UniPile credentials
- **Webhook issues**: Check SSL and URL accessibility

### Support Resources
- Check `CLIENT_SETUP_GUIDE.md` for detailed instructions
- Review console logs for error messages
- Test each component individually
- Verify network connectivity

---

**✅ All items checked? Your WhatsApp messaging application is ready!**
