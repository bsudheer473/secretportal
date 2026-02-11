import { PublishCommand } from '@aws-sdk/client-sns';
import { snsClient } from './aws-clients';
import axios from 'axios';

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL || '';
const USE_TEAMS = process.env.USE_TEAMS_NOTIFICATIONS === 'true';

interface TeamsNotification {
  notificationType: string;
  title: string;
  message: string;
  secretName: string;
  application: string;
  environment: string;
  action: string;
  user: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  portalUrl?: string;
}

/**
 * Send notification to Microsoft Teams via Power Automate
 */
async function sendTeamsNotification(notification: TeamsNotification): Promise<void> {
  if (!USE_TEAMS || !TEAMS_WEBHOOK_URL) {
    console.log('Teams notifications disabled or webhook URL not configured');
    return;
  }

  try {
    await axios.post(TEAMS_WEBHOOK_URL, notification, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 5000, // 5 second timeout
    });

    console.log('Teams notification sent successfully', { 
      type: notification.notificationType,
      secret: notification.secretName 
    });
  } catch (error) {
    console.error('Failed to send Teams notification:', error);
    // Don't throw - notification failure shouldn't break the main flow
  }
}

/**
 * Send notification for Prod secret changes
 */
export async function sendProdSecretChangeNotification(
  secretName: string,
  application: string,
  action: 'UPDATE' | 'ROTATION_CHANGE',
  details: string,
  userId: string
): Promise<void> {
  const actionText = action === 'UPDATE' ? 'Secret Value Updated' : 'Rotation Period Changed';
  const timestamp = new Date().toISOString();
  
  // Send to Teams
  if (USE_TEAMS) {
    await sendTeamsNotification({
      notificationType: 'prod_change',
      title: '🔴 Production Secret Changed',
      message: `A production secret has been modified. ${details}`,
      secretName,
      application,
      environment: 'Prod',
      action: actionText,
      user: userId,
      timestamp,
      severity: 'high',
      portalUrl: process.env.PORTAL_URL || 'http://44.220.58.117',
    });
  }

  // Send to SNS (email) if configured
  if (SNS_TOPIC_ARN) {
    const message = `Production Secret Change Alert\n\n` +
      `Action: ${actionText}\n` +
      `Secret: ${secretName}\n` +
      `Application: ${application}\n` +
      `Environment: Prod\n` +
      `Details: ${details}\n` +
      `Modified By: ${userId}\n` +
      `Timestamp: ${timestamp}\n\n` +
      `This is an automated notification for production secret changes.`;

    try {
      const command = new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: `[PROD] ${actionText} - ${secretName}`,
        Message: message,
      });

      await snsClient.send(command);
      console.log('Sent Prod secret change notification via SNS', { secretName, action });
    } catch (error) {
      console.error('Failed to send SNS notification', error);
    }
  }
}

/**
 * Send rotation alert notification
 */
export async function sendRotationAlertNotification(
  secretName: string,
  application: string,
  environment: string,
  daysSinceRotation: number,
  rotationPeriod: number
): Promise<void> {
  if (!USE_TEAMS) {
    return;
  }

  const daysOverdue = daysSinceRotation - rotationPeriod;
  const severity: 'low' | 'medium' | 'high' = 
    daysOverdue > 30 ? 'high' : daysOverdue > 7 ? 'medium' : 'low';

  await sendTeamsNotification({
    notificationType: 'rotation_alert',
    title: '⚠️ Secret Rotation Required',
    message: `Secret "${secretName}" needs rotation. Last rotated ${daysSinceRotation} days ago (policy: ${rotationPeriod} days). Overdue by ${daysOverdue} days.`,
    secretName,
    application,
    environment,
    action: 'ROTATION_REQUIRED',
    user: 'System',
    timestamp: new Date().toISOString(),
    severity,
    portalUrl: process.env.PORTAL_URL || 'http://44.220.58.117',
  });
}

/**
 * Send console change notification
 */
export async function sendConsoleChangeNotification(
  secretName: string,
  application: string,
  environment: string,
  changeType: string,
  userArn: string
): Promise<void> {
  if (!USE_TEAMS) {
    return;
  }

  await sendTeamsNotification({
    notificationType: 'console_change',
    title: '🔍 Direct AWS Console Change Detected',
    message: `A secret was modified directly in AWS Console, bypassing the portal. This may indicate unauthorized access or manual intervention.`,
    secretName,
    application,
    environment,
    action: changeType,
    user: userArn,
    timestamp: new Date().toISOString(),
    severity: 'medium',
    portalUrl: process.env.PORTAL_URL || 'http://44.220.58.117',
  });
}
