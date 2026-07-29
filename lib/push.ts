import webpush from "web-push";
import { prisma } from "./prisma";

function getConfiguredWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return webpush;
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url: string }) {
  const client = getConfiguredWebPush();
  if (!client) {
    console.error("sendPushToUser: VAPID keys are not configured — no push will be sent.");
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) {
    console.log(`sendPushToUser: user ${userId} has no push subscriptions — nothing to send.`);
    return;
  }

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await client.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dhKey, auth: subscription.authKey }
          },
          JSON.stringify(payload)
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        const body = (error as { body?: string }).body;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or was revoked on the client — clean it up.
          await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
        } else {
          // Anything else (bad VAPID keys, malformed payload, push service
          // outage, etc.) was previously swallowed with zero trace — log it
          // so a real delivery failure is actually diagnosable from server
          // logs instead of just "no notification arrived, no idea why".
          console.error(`Push send failed for subscription ${subscription.id} (user ${userId}):`, statusCode, body ?? error);
        }
      }
    })
  );
}
