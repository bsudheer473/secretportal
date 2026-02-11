# Requirements Document

## Introduction

This document defines the requirements for a Secrets Management Portal that provides centralized secret storage, rotation tracking, and user-friendly access to AWS Secrets Manager across multiple applications and environments. The system will manage secrets for 6 applications across non-production (NP), pre-production (PP), and production (Prod) environments, with automated notifications for secrets requiring rotation.

## Glossary

- **Portal**: The Secrets Management Portal web application
- **Secret**: A confidential credential (password, API key, token, etc.) stored in AWS Secrets Manager
- **Rotation Period**: The maximum number of days a secret can remain unchanged before requiring rotation
- **Environment**: A deployment tier (NP, PP, or Prod) where applications run
- **Application**: One of the 6 distinct software systems using secrets
- **User**: An authenticated person accessing the Portal
- **AWS Secrets Manager**: The AWS service providing secure secret storage
- **Notification**: An alert sent to users about secrets requiring rotation

## Requirements

### Requirement 1

**User Story:** As a security administrator, I want to store secrets for all 6 applications across NP, PP, and Prod environments in AWS Secrets Manager, so that credentials are centrally managed and secure.

#### Acceptance Criteria

1. THE Portal SHALL store secrets in AWS Secrets Manager with tags identifying the application name and environment type
2. THE Portal SHALL support creating secrets for each of the 6 applications in NP, PP, and Prod environments
3. THE Portal SHALL enforce unique naming conventions for secrets that include application identifier and environment identifier
4. THE Portal SHALL encrypt all secrets using AWS Secrets Manager encryption at rest
5. WHEN a user creates a secret, THE Portal SHALL record the creation timestamp in the secret metadata

### Requirement 2

**User Story:** As a compliance officer, I want to receive notifications when secrets have not been changed for 90 days, so that I can ensure regular credential rotation.

#### Acceptance Criteria

1. THE Portal SHALL check the last modified date of each secret daily at 09:00 UTC
2. WHEN a secret has not been modified for 90 days or more, THE Portal SHALL send a notification to designated users
3. THE Portal SHALL include the secret name, application, environment, and days since last rotation in each notification
4. THE Portal SHALL send notifications via email to configured recipient addresses
5. THE Portal SHALL track notification history to prevent duplicate alerts for the same rotation period

### Requirement 3

**User Story:** As a security administrator, I want to configure custom rotation periods for specific secrets (45 or 60 days), so that high-risk credentials can be rotated more frequently.

#### Acceptance Criteria

1. THE Portal SHALL allow administrators to set a custom rotation period of 45, 60, or 90 days for each secret
2. WHEN a custom rotation period is configured, THE Portal SHALL use that period instead of the default 90 days for notification checks
3. THE Portal SHALL store the rotation period configuration in the secret metadata
4. THE Portal SHALL validate that rotation period values are limited to 45, 60, or 90 days
5. WHERE no custom rotation period is specified, THE Portal SHALL default to 90 days

### Requirement 4

**User Story:** As a developer, I want to search for secrets by application name, environment, or secret name, so that I can quickly find the credentials I need.

#### Acceptance Criteria

1. THE Portal SHALL provide a search interface accepting text input for application name, environment, or secret name
2. WHEN a user enters search criteria, THE Portal SHALL return matching secrets within 2 seconds
3. THE Portal SHALL support partial text matching for search queries
4. THE Portal SHALL display search results showing secret name, application, environment, and last modified date
5. THE Portal SHALL filter search results based on the user's access permissions

### Requirement 5

**User Story:** As a developer, I want to view secret details and access them through AWS console, so that I can retrieve credentials securely without the portal handling sensitive values.

#### Acceptance Criteria

1. THE Portal SHALL display a list of all secrets the user has permission to access with their tags
2. WHEN a user selects a secret, THE Portal SHALL display the secret name, application tag, environment tag, rotation period, and last modified date
3. THE Portal SHALL provide a button to open the secret in AWS console
4. WHEN a user clicks the AWS console button, THE Portal SHALL generate and display the AWS console URL for that secret
5. THE Portal SHALL log all console URL access events including user identity and timestamp

### Requirement 6

**User Story:** As a security administrator, I want to authenticate users before they access the Portal, so that only authorized personnel can view or manage secrets.

#### Acceptance Criteria

1. THE Portal SHALL require user authentication before granting access to any functionality
2. THE Portal SHALL integrate with an identity provider for user authentication
3. WHEN authentication fails, THE Portal SHALL deny access and display an error message
4. THE Portal SHALL maintain user session state for 8 hours of inactivity before requiring re-authentication
5. THE Portal SHALL enforce role-based access control to limit secret visibility based on user permissions

### Requirement 7

**User Story:** As a security administrator, I want to update existing secrets through the Portal, so that I can rotate credentials without using the AWS console.

#### Acceptance Criteria

1. THE Portal SHALL provide an interface for updating secret values
2. WHEN a user updates a secret, THE Portal SHALL update the last modified timestamp in AWS Secrets Manager
3. THE Portal SHALL validate that the user has permission to modify the secret before allowing updates
4. THE Portal SHALL require confirmation before applying secret updates
5. THE Portal SHALL reset the rotation notification timer when a secret is updated

### Requirement 8

**User Story:** As a system administrator, I want the Portal to handle AWS API failures gracefully, so that temporary issues do not disrupt user access.

#### Acceptance Criteria

1. WHEN AWS Secrets Manager API calls fail, THE Portal SHALL retry the request up to 3 times with exponential backoff
2. IF all retry attempts fail, THE Portal SHALL display a user-friendly error message
3. THE Portal SHALL log all AWS API errors with timestamp and error details
4. THE Portal SHALL continue serving cached secret metadata when AWS API is temporarily unavailable
5. THE Portal SHALL display a warning banner when operating in degraded mode with cached data
