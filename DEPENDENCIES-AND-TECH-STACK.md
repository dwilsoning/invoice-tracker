# Invoice Tracker - Dependencies and Tech Stack

## System Requirements

### Required Software
- **Node.js**: v18.x or higher (tested with v18.19.1)
- **npm**: v9.x or higher (tested with v9.2.0)
- **PostgreSQL**: v12.x or higher (recommended v14+)
- **Operating System**: Windows, macOS, or Linux

### Development Tools (Optional)
- **Git**: For version control
- **VS Code**: Recommended IDE
- **Postman**: For API testing
- **pgAdmin** or **DBeaver**: For database management

---

## Architecture Overview

The Invoice Tracker is a full-stack web application with a clear separation between frontend and backend:

```
Invoice Tracker
├── invoice-tracker-frontend/    # React SPA
└── Invoice-tracker-backend/     # Node.js REST API
```

### Architecture Pattern
- **Frontend**: Single Page Application (SPA)
- **Backend**: RESTful API
- **Database**: PostgreSQL relational database
- **Authentication**: JWT-based token authentication
- **Communication**: HTTP/HTTPS with JSON payloads

---

## Backend Stack

### Core Framework
- **Express.js** (v4.18.2)
  - Fast, unopinionated web framework for Node.js
  - Handles HTTP routing, middleware, and request/response
  - RESTful API design

### Database
- **PostgreSQL** (via `pg` v8.11.3)
  - Primary production database
  - Relational database with ACID compliance
  - Advanced querying capabilities

- **SQLite** (via `sqlite3` v5.1.7, `sql.js` v1.13.0)
  - Legacy support (being phased out)
  - File-based database for development/testing

### Authentication & Security
- **bcrypt** (via `utils/auth.js`)
  - Password hashing and verification
  - Secure password storage

- **JWT (JSON Web Tokens)** (via `utils/jwt.js`)
  - Stateless authentication
  - Token-based session management
  - 7-day token expiration

### Key Dependencies

#### Production Dependencies
```json
{
  "axios": "^1.6.5",           // HTTP client for external API calls
  "cors": "^2.8.5",            // Cross-Origin Resource Sharing middleware
  "dotenv": "^16.3.1",         // Environment variable management
  "exceljs": "^4.4.0",         // Excel file parsing and generation
  "express": "^4.18.2",        // Web framework
  "formidable": "^3.5.1",      // File upload handling
  "pdf-parse": "^1.1.1",       // PDF parsing for invoice extraction
  "pg": "^8.11.3"              // PostgreSQL client
}
```

#### Development Dependencies
```json
{
  "@types/jest": "^30.0.0",    // TypeScript definitions for Jest
  "jest": "^29.7.0",           // Testing framework
  "nodemon": "^3.0.2",         // Auto-restart on file changes
  "supertest": "^7.1.4"        // HTTP assertion testing
}
```

### Middleware & Utilities

#### CORS (Cross-Origin Resource Sharing)
- **Purpose**: Allows frontend (localhost:5173) to communicate with backend (localhost:3001)
- **Configuration**: Configured in `server-postgres.js`
- **Usage**: `app.use(cors())`

#### Custom Middleware
- **Authentication Middleware** (`middleware/auth.js`)
  - `authenticateToken`: Verifies JWT tokens
  - `requireAdmin`: Checks for admin role
  - `optionalAuth`: Attaches user if token is valid

#### Utilities
- **Auth Utils** (`utils/auth.js`)
  - Password hashing/verification with bcrypt
  - Email validation
  - Password strength validation
  - User ID generation

- **JWT Utils** (`utils/jwt.js`)
  - Token creation and verification
  - Token payload management

### File Processing
- **PDF Parsing**: `pdf-parse` for extracting invoice data from PDFs
- **Excel Processing**: `exceljs` for reading/writing Excel files
- **File Uploads**: `formidable` for handling multipart form data

---

## Frontend Stack

### Core Framework
- **React** (v18.2.0)
  - Component-based UI library
  - Hooks for state management
  - Virtual DOM for performance

- **React DOM** (v18.2.0)
  - DOM rendering for React
  - Browser-specific implementations

### Build Tool
- **Vite** (v7.1.11)
  - Next-generation frontend build tool
  - Lightning-fast Hot Module Replacement (HMR)
  - Optimized production builds
  - ES modules-based development server

### Styling
- **Tailwind CSS** (v3.4.0)
  - Utility-first CSS framework
  - Responsive design utilities
  - Custom design system
  - JIT (Just-In-Time) compilation

- **PostCSS** (v8.4.32)
  - CSS transformation tool
  - Works with Tailwind CSS
  - Autoprefixer for browser compatibility

- **Autoprefixer** (v10.4.16)
  - Adds vendor prefixes to CSS
  - Browser compatibility layer

### Data Visualization
- **Recharts** (v3.3.0)
  - React charting library
  - Built on D3.js
  - Used for analytics dashboard
  - Responsive charts and graphs

### HTTP Client
- **Axios** (v1.6.5)
  - Promise-based HTTP client
  - Request/response interceptors
  - Automatic JSON transformation
  - Used for all API calls

### Dependencies

#### Production Dependencies
```json
{
  "axios": "^1.6.5",           // HTTP client for API calls
  "react": "^18.2.0",          // UI framework
  "react-dom": "^18.2.0",      // React DOM renderer
  "recharts": "^3.3.0"         // Charting library
}
```

#### Development Dependencies
```json
{
  "@types/react": "^18.2.43",          // React TypeScript types
  "@types/react-dom": "^18.2.17",      // React DOM TypeScript types
  "@vitejs/plugin-react": "^4.2.1",    // Vite React plugin
  "autoprefixer": "^10.4.16",          // CSS autoprefixer
  "postcss": "^8.4.32",                // CSS transformer
  "tailwindcss": "^3.4.0",             // Utility CSS framework
  "vite": "^7.1.11"                    // Build tool
}
```

### State Management
- **React Context API**
  - `AuthContext`: Authentication state management
  - User information
  - Token management
  - Login/logout functionality

### React Hooks Used
- `useState`: Component state
- `useEffect`: Side effects and lifecycle
- `useContext`: Context consumption
- `useCallback`: Memoized callbacks

---

## Authentication System

### Technology
- **JWT (JSON Web Tokens)**
  - Stateless authentication
  - Token stored in localStorage
  - Included in Authorization header

### Security Features
- Password hashing with bcrypt (salt rounds: 10)
- Password strength validation
- Token expiration (7 days)
- Secure HTTP-only recommendations
- Role-based access control (RBAC)

### Authentication Flow
```
1. User submits credentials → POST /api/auth/login
2. Backend validates credentials
3. Backend generates JWT token
4. Frontend stores token in localStorage
5. Frontend includes token in all requests (Authorization: Bearer <token>)
6. Backend middleware verifies token
7. Request proceeds if valid, rejected if invalid
```

---

## Database Schema

### Tables
- **invoices**: Invoice records with payment tracking
- **expected_invoices**: Expected recurring invoices
- **contract_values**: Contract value tracking
- **dismissals**: Dismissed expected invoice tracking
- **users**: User accounts and authentication
- **payment_uploads**: Payment file upload history

### Database Features
- ACID compliance
- Foreign key constraints
- Triggers for automatic timestamp updates
- Indexes for performance optimization

---

## API Design

### REST Principles
- Resource-based URLs
- HTTP methods (GET, POST, PUT, DELETE)
- JSON request/response format
- Stateless communication

### Authentication Endpoints
```
POST   /api/auth/login           - User login
GET    /api/auth/verify          - Verify token
POST   /api/auth/change-password - Change password
```

### User Management Endpoints (Admin)
```
GET    /api/users                - List all users
GET    /api/users/:id            - Get user by ID
POST   /api/users                - Create user
PUT    /api/users/:id            - Update user
DELETE /api/users/:id            - Delete user
```

### Invoice Endpoints
```
GET    /api/invoices             - List invoices
POST   /api/invoices             - Upload invoice
PUT    /api/invoices/:id         - Update invoice
DELETE /api/invoices/:id         - Delete invoice
```

---

## Development Tools

### Backend Scripts
```bash
npm run start:postgres    # Start production server
npm run dev:postgres      # Start development server with auto-reload
npm run backup            # Backup database
npm run test              # Run tests
```

### Frontend Scripts
```bash
npm run dev               # Start development server (localhost:5173)
npm run build             # Build for production
npm run preview           # Preview production build
```

---

## Environment Configuration

### Backend (.env)
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoice_tracker
DB_USER=invoice_tracker_user
DB_PASSWORD=your_password

# Server
PORT=3001
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Authentication
JWT_SECRET=your-secret-key-here
```

### Frontend
- API URL configured in source code
- Default: `http://localhost:3001/api`
- Can be changed in `src/contexts/AuthContext.jsx` and `src/App.jsx`

---

## Key Features by Technology

### Express.js Features
- Middleware pipeline
- Route parameter validation
- Error handling
- Static file serving
- JSON body parsing

### React Features
- Component composition
- Hooks for state and effects
- Context API for global state
- Virtual DOM diffing
- Lazy loading potential

### Tailwind CSS Features
- Responsive design utilities
- Custom color palette
- Flexbox and Grid utilities
- Hover/focus states
- Dark mode support (not implemented)

### PostgreSQL Features
- JSONB for flexible data
- Full-text search capability
- Transaction support
- Connection pooling
- Advanced indexing

---

## Browser Compatibility

### Supported Browsers
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)

### Required Features
- ES6+ JavaScript
- Fetch API / XMLHttpRequest
- LocalStorage
- CSS Grid & Flexbox

---

## Performance Considerations

### Backend
- Connection pooling for database
- Efficient query design
- File streaming for large uploads
- Response compression potential

### Frontend
- Vite's optimized builds
- Code splitting capability
- Lazy loading potential
- Virtual scrolling for large lists (to implement)

---

## Security Considerations

### Implemented
- ✅ Password hashing
- ✅ JWT authentication
- ✅ CORS configuration
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (React escaping)
- ✅ Input validation

### Recommended for Production
- [ ] HTTPS/SSL certificates
- [ ] Rate limiting
- [ ] Content Security Policy
- [ ] Helmet.js for security headers
- [ ] Environment-based secrets management
- [ ] Database backup automation

---

## File Structure

### Backend
```
Invoice-tracker-backend/
├── middleware/          # Custom middleware (auth)
├── routes/             # API route handlers
├── utils/              # Utility functions
├── migrations/         # Database migrations
├── scripts/            # Helper scripts
├── uploads/            # Uploaded files
├── invoice_pdfs/       # PDF storage
├── server-postgres.js  # Main server file
└── db-postgres.js      # Database connection
```

### Frontend
```
invoice-tracker-frontend/
├── src/
│   ├── components/     # React components
│   ├── contexts/       # React contexts
│   ├── App.jsx         # Main app component
│   ├── main.jsx        # Entry point
│   └── index.css       # Global styles
├── public/             # Static assets
└── index.html          # HTML template
```

---

## Third-Party Services

### External APIs
- **Exchange Rate API** (exchangerate-api.com)
  - Free tier
  - Currency conversion
  - Updates every 6 hours

### None Required
- No email service needed (authentication is in-app)
- No cloud storage needed (local file storage)
- No payment gateway needed

---

## Development vs Production

### Development
- Hot reload with Vite and Nodemon
- Detailed error messages
- Development source maps
- CORS allows all origins

### Production Recommendations
- Set `NODE_ENV=production`
- Use HTTPS
- Restrict CORS origins
- Minified builds
- Error logging service
- Process manager (PM2)
- Reverse proxy (Nginx)

---

## Testing

### Backend Testing
- **Jest**: Test runner
- **Supertest**: HTTP assertion library
- Unit tests for utilities
- Integration tests for API

### Frontend Testing
- Currently no testing framework
- Recommended: Vitest + React Testing Library

---

## Deployment Considerations

### Backend Deployment
- Node.js hosting (Heroku, DigitalOcean, AWS)
- PostgreSQL database (managed or self-hosted)
- Environment variables configuration
- SSL certificate setup

### Frontend Deployment
- Static hosting (Vercel, Netlify, AWS S3)
- Build command: `npm run build`
- Serve `dist/` folder
- Configure API URL for production

---

## Future Technology Considerations

### Potential Additions
- TypeScript for type safety
- Redis for session/cache management
- WebSocket for real-time updates
- Docker for containerization
- CI/CD pipeline (GitHub Actions)
- Monitoring (Sentry, LogRocket)

---

## Support & Documentation

### Official Documentation
- [Express.js](https://expressjs.com/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [PostgreSQL](https://www.postgresql.org/docs/)
- [Recharts](https://recharts.org/)

### Project Documentation
- `README.md` - Project overview
- `INSTALLATION.md` - Setup instructions
- `PREREQUISITES.md` - System requirements
- `Invoice-tracker-backend/docs/AUTHENTICATION.md` - Auth API docs
- `invoice-tracker-frontend/AUTHENTICATION.md` - User guide
