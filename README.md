# Change Validator Application

A comprehensive web application for validating and integrating Git changes through an automated workflow CSV file validation, and Jenkins integration.

## Architecture Overview

### Frontend
- **React 18** with TypeScript
- **Material-UI** for professional UI components
- **Supabase Client** for real-time data synchronization
- **React Router** for navigation
- **Role-based access control** via LDAP groups

### Backend
- **Supabase Self-Hosted** with PostgreSQL
- **LDAP Authentication** via custom Edge Functions
- **Row Level Security (RLS)** for data access control
- **Real-time subscriptions** for live updates
- **File storage** for CSV diffs and validated files

### Integration
- **Jenkins** for automated diff generation and integration
- **Edge Functions** for webhook handling
- **Git workflow** integration with branch management

## Features

### 🔐 Authentication & Authorization
- LDAP authentication with automatic user mapping
- Role-based access control (Admin, Validator, Creator)
- Session management with JWT tokens
- Real-time permission updates

### 📊 Task Management
- Create validation tasks from Git branches
- Real-time status updates
- File upload/download with drag & drop
- Advanced filtering and search
- Audit trail with LDAP user tracking

### 🔄 Automated Workflow
- Jenkins integration for diff generation
- Webhook notifications for status updates
- Automatic file storage and retrieval
- Error handling and retry mechanisms

### 🎨 User Interface
- Responsive Material Design
- Real-time updates without page refresh
- Role-based UI components
- Comprehensive error handling
- Loading states and progress indicators

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ for frontend development
- Jenkins server with Git access
- LDAP server for authentication

### 1. Environment Setup
```bash
# Copy environment files
cp .env.example .env
cp frontend/.env.example frontend/.env

# Update configuration with your values
# Edit .env and frontend/.env files
```

### 2. Start Supabase Backend
```bash
# Start all Supabase services
docker-compose up -d

# Wait for services to be ready
docker-compose logs -f
```

### 3. Setup Database
```bash
# Database migrations are automatically applied
# Check migration status
docker-compose exec supabase-db psql -U supabase -c "\\dt"
```

### 4. Configure Jenkins
```bash
# Setup Jenkins jobs
cd jenkins
chmod +x setup-jenkins.sh
./setup-jenkins.sh
```

### 5. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Supabase API: http://localhost:8000
- Jenkins: http://localhost:8080 (if running locally)

## Development

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build
```

### Backend Development
```bash
# View Supabase logs
docker-compose logs -f supabase-rest supabase-auth

# Access database directly
docker-compose exec supabase-db psql -U supabase

# Restart Edge Functions
docker-compose restart supabase-edge
```

### Testing
```bash
# Frontend unit tests
cd frontend
npm run test

# Integration tests
npm run test:run

# Test coverage report
npm run test:coverage

# Backend function testing
# Test LDAP authentication
curl -X POST http://localhost:8000/functions/v1/ldap-auth \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass"}'
```

## Configuration

### Environment Variables

#### Core Application (.env)
```bash
# Database
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=supabase
POSTGRES_USER=supabase

# API URLs
API_EXTERNAL_URL=http://localhost:8000
SITE_URL=http://localhost:3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-token-32-chars-min
JWT_EXPIRY=3600

# Supabase Keys
ANON_KEY=your-anon-key
SERVICE_ROLE_KEY=your-service-role-key

# LDAP Configuration
LDAP_URL=ldap://your-ldap-server:389
LDAP_USER_BASE=ou=users,dc=company,dc=com
LDAP_BIND_DN=cn=service,dc=company,dc=com
LDAP_BIND_PASSWORD=your-ldap-password

# Jenkins Integration
JENKINS_BASE_URL=https://jenkins.company.com
JENKINS_API_TOKEN=your-jenkins-token
```

#### Frontend (.env)
```bash
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### LDAP Groups and Permissions

| Group | Permissions |
|-------|------------|
| `admins` | Full access to all features |
| `validators` | Can validate and approve tasks |
| `creators` | Can create new validation tasks |
| `users` | Read-only access to tasks |

### Database Schema

Key tables:
- `validation_tasks` - Main task tracking
- `ldap_users` - LDAP user mapping
- Storage buckets for file management

## API Documentation

### Edge Functions

#### `/functions/v1/ldap-auth`
Authenticates users against LDAP and creates/updates Supabase sessions.

**POST Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "displayName": "string",
    "groups": ["string"]
  },
  "session": "jwt_token"
}
```

#### `/functions/v1/trigger-diff-generation`
Triggers Jenkins job to generate diff files.

#### `/functions/v1/jenkins-webhook`
Handles webhook notifications from Jenkins.

#### `/functions/v1/trigger-integration`
Triggers Jenkins integration job for validated files.

### Database API

All database operations use Supabase's auto-generated REST API with Row Level Security (RLS) policies based on LDAP groups.

## Deployment

### Production Deployment
```bash
# Build frontend for production
cd frontend
npm run build

# Update docker-compose for production
cp docker-compose.yml docker-compose.prod.yml
# Edit production configuration

# Deploy with production settings
docker-compose -f docker-compose.prod.yml up -d

# Setup SSL/TLS certificates
# Configure reverse proxy (Nginx/Traefik)
# Setup monitoring and logging
```

### Health Checks
```bash
# Check all services
docker-compose ps

# Test API endpoints
curl http://localhost:8000/health

# Test Edge Functions
curl http://localhost:8000/functions/v1/health
```

## Monitoring & Troubleshooting

### Logs
```bash
# View all logs
docker-compose logs

# Specific service logs
docker-compose logs supabase-rest
docker-compose logs supabase-auth
docker-compose logs supabase-edge

# Follow logs in real-time
docker-compose logs -f
```

### Common Issues

1. **LDAP Authentication Failures**
   - Check LDAP server connectivity
   - Verify service account credentials
   - Review LDAP configuration in Edge Functions

2. **File Upload Issues**
   - Check storage bucket policies
   - Verify file size limits
   - Review CORS configuration

3. **Jenkins Integration Problems**
   - Validate Jenkins API tokens
   - Check webhook URLs and connectivity
   - Review job configurations

4. **Real-time Updates Not Working**
   - Check Supabase Realtime service
   - Verify WebSocket connections
   - Review subscription configurations

### Performance Optimization

- Enable PostgreSQL query optimization
- Configure CDN for static assets
- Implement connection pooling
- Monitor database performance
- Set up caching strategies

## Security Considerations

- Store secrets in environment variables
- Use HTTPS in production
- Implement proper CORS policies
- Regular security updates
- Monitor access logs
- Backup database regularly

## Contributing

1. Fork the repository
2. Create feature branch
3. Run tests: `npm run test`
4. Submit pull request

## License

[Your License Here]

## Support

For support, please contact the development team or create an issue in the repository.
