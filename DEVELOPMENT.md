# Development Workflow

## CI/CD Integration

### Automated Testing
External services health checks are automatically run:

- **On Pull Requests** to `main` branch
- **On Push** to `main` branch  
- **Daily at 8 AM UTC** for monitoring
- **Manually** via GitHub Actions

### Local Development

Before committing changes, run:
```bash
npm run pre-commit
```

This will:
1. Test external services (Cloudflare DNS, RDAP)
2. Run TypeScript type checking
3. Ensure everything is ready for deployment

### Manual Testing

Test external services independently:
```bash
npm run test:external
```

### CI/CD Pipeline

1. **External Services Check** - Validates DNS and RDAP services
2. **Type Check** - Ensures TypeScript compilation
3. **Build** - Creates production bundle
4. **Deploy** - Only if all previous steps pass

### Service Monitoring

The GitHub Action provides:
- ✅ **Green badge** when all services are healthy
- ❌ **Red badge** when services are down
- 📊 **Daily monitoring** to catch service outages

### Troubleshooting

If external services tests fail:
- Check if Cloudflare DNS is accessible
- Verify RDAP bootstrap service (IANA)
- Check specific RDAP providers (.com, .org, etc.)
- Look at GitHub Actions logs for detailed error messages
