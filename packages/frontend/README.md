# Secrets Management Portal - Frontend

React-based frontend application for the Secrets Management Portal.

## Features

- **Authentication**: AWS Cognito integration with JWT token management
- **Secrets Management**: List, view, create, and update secrets
- **Search & Filter**: Real-time search with autocomplete and filtering by application/environment
- **Rotation Tracking**: Visual indicators for secrets requiring rotation
- **Audit Logging**: View access history for each secret
- **AWS Console Integration**: Direct links to AWS Secrets Manager console
- **Error Handling**: Comprehensive error handling with retry logic and user-friendly messages

## Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Environment Configuration

Create a `.env` file in the `packages/frontend` directory:

```env
VITE_API_BASE_URL=https://your-api-gateway-url.amazonaws.com
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_AWS_REGION=us-east-1
```

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Build

```bash
npm run build
```

The production build will be created in the `dist` directory.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ErrorBoundary.tsx
│   ├── Layout.tsx
│   ├── ProtectedRoute.tsx
│   ├── SearchBar.tsx
│   └── DegradedModeWarning.tsx
├── contexts/           # React contexts
│   └── ToastContext.tsx
├── hooks/              # Custom React hooks
│   └── useApiWithRetry.ts
├── pages/              # Page components
│   ├── Login.tsx
│   ├── SecretsList.tsx
│   ├── SecretDetail.tsx
│   ├── CreateSecret.tsx
│   ├── UpdateSecret.tsx
│   └── AccessDenied.tsx
├── services/           # API and authentication services
│   ├── api-client.ts
│   └── auth.ts
├── config/             # Configuration
│   └── environment.ts
├── App.tsx             # Main application component
└── main.tsx            # Application entry point
```

## Key Components

### Authentication
- **Login**: Email/password authentication with AWS Cognito
- **ProtectedRoute**: Route guard that checks authentication status
- **Token Management**: Automatic token refresh every 50 minutes

### Secrets Management
- **SecretsList**: Paginated table with filtering and search
- **SecretDetail**: Detailed view with metadata and audit log
- **CreateSecret**: Form for creating new secrets with validation
- **UpdateSecret**: Update secret values and rotation periods

### Error Handling
- **ErrorBoundary**: Catches React errors and displays fallback UI
- **API Retry Logic**: Automatic retry for failed API calls (up to 3 attempts)
- **403 Handling**: Redirects to access denied page
- **503 Handling**: Shows degraded mode warning banner

## Technologies

- **React 18**: UI framework
- **TypeScript**: Type safety
- **Material-UI (MUI)**: Component library
- **React Router v6**: Client-side routing
- **Axios**: HTTP client
- **AWS Amplify**: Authentication with Cognito
- **Vite**: Build tool and dev server

## User Permissions

The application respects Cognito user groups for access control:

- `secrets-admin`: Full access to all secrets
- `app{1-6}-developer`: Read/write access to specific app's NP/PP secrets
- `app{1-6}-prod-viewer`: Read-only access to specific app's Prod secrets

## Development Notes

- All API calls include JWT token in Authorization header
- Session storage is used for token persistence
- Automatic logout on 401 responses
- Redirect to access denied page on 403 responses
- Form validation follows naming conventions (alphanumeric and hyphens only)
- Rotation period warnings shown when days since rotation >= 80% of rotation period
