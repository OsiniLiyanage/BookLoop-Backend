package lk.jiat.controller;

import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.FieldValue;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import lk.jiat.util.FirebaseUtil;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import java.util.*;
import java.util.concurrent.ExecutionException;

/*
 * OrderController — view orders and update their status.
 * Orders are created by the Android app in Firestore "orders" collection.
 *
 * Endpoints:
 *   GET   /api/v1/orders                    → all orders
 *   PATCH /api/v1/orders/{id}/status        → update status (+ sends a push to the customer)
 *
 * Order statuses: PAID → CONFIRMED → PROCESSING → DELIVERED → RETURNED
 *
 * PUSH NOTIFICATION (Firebase Cloud Messaging):
 *   After the status is saved, the server looks up the customer's FCM token
 *   (Firestore users/{userId}.fcmToken, saved by the Android app) and sends a
 *   DATA message: type=order_status, docId, orderId, status.
 *   The app's BookLoopMessagingService receives it and shows the notification.
 *   If the push fails for any reason, the status change is STILL saved and the
 *   API still answers success (the result just says the push was not sent).
 *
 * NOTE on the Firestore index error:
 *   The orderBy("orderDate") query requires a Firestore index.
 *   If this fails, we fall back to getting orders without ordering.
 *   Fix: Firebase Console → Firestore → Indexes → create index on "orders" collection,
 *   field "orderDate" Descending.
 */
@Path("/orders")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class OrderController {

    @GET
    public Response getAllOrders() {
        try {
            Firestore db = FirebaseUtil.getFirestore();

            QuerySnapshot snapshot;
            try {
                // Try with ordering first (requires Firestore index)
                snapshot = db.collection("orders")
                        .orderBy("orderDate", Query.Direction.DESCENDING)
                        .get().get();
            } catch (Exception indexError) {
                // Fallback: no ordering if index doesn't exist yet
                System.out.println("Orders index not ready, loading without ordering. " +
                        "Create index in Firebase Console to fix this.");
                snapshot = db.collection("orders").get().get();
            }

            List<Map<String, Object>> orders = new ArrayList<>();
            for (QueryDocumentSnapshot doc : snapshot.getDocuments()) {
                Map<String, Object> order = new HashMap<>(doc.getData());
                order.put("firestoreId", doc.getId());
                orders.add(order);
            }
            return Response.ok(orders).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to load orders: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    // PATCH /api/v1/orders/{firestoreId}/status
    // Body: { "status": "DELIVERED" }
    @PATCH
    @Path("/{firestoreId}/status")
    public Response updateOrderStatus(@PathParam("firestoreId") String firestoreId,
                                      Map<String, Object> body) {
        try {
            Firestore db = FirebaseUtil.getFirestore();

            String status = body != null ? (String) body.get("status") : null;
            if (status == null || status.isEmpty()) {
                Map<String, Object> err = new HashMap<>();
                err.put("error", "status field required");
                return Response.status(Response.Status.BAD_REQUEST).entity(err).build();
            }

            // Read the order first: we need its userId / orderId for the push,
            // and its old status so we only notify when the status really changes.
            DocumentSnapshot orderDoc = db.collection("orders")
                    .document(firestoreId)
                    .get()
                    .get();

            if (!orderDoc.exists()) {
                Map<String, Object> err = new HashMap<>();
                err.put("error", "Order not found: " + firestoreId);
                return Response.status(Response.Status.NOT_FOUND).entity(err).build();
            }

            String oldStatus = orderDoc.getString("status");
            String userId    = orderDoc.getString("userId");
            String orderId   = orderDoc.getString("orderId");

            // Save the new status (same as before)
            db.collection("orders")
                    .document(firestoreId)
                    .update("status", status)
                    .get();

            // Send the push. Never throws: a push problem must not break the status update.
            String pushResult;
            if (status.equals(oldStatus)) {
                pushResult = "skipped (status unchanged)";
            } else {
                pushResult = sendOrderStatusPush(db, firestoreId, orderId, userId, status);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("message", "Order status updated to " + status);
            result.put("firestoreId", firestoreId);
            result.put("status", status);
            result.put("push", pushResult);
            return Response.ok(result).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to update order: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    // Sends the "order status changed" push to the customer who owns the order.
    // Returns a short text describing what happened. Catches everything itself.
    private String sendOrderStatusPush(Firestore db, String firestoreId, String orderId,
                                       String userId, String status) {
        try {
            if (userId == null || userId.isEmpty()) {
                return "not sent (order has no userId)";
            }

            // The app saved this token on the user document (Step 1)
            DocumentSnapshot userDoc = db.collection("users").document(userId).get().get();
            String token = userDoc.exists() ? userDoc.getString("fcmToken") : null;
            if (token == null || token.isEmpty()) {
                System.out.println("PUSH: user " + userId + " has no fcmToken (logged out?) - not sent");
                return "not sent (customer has no push token)";
            }

            // DATA-only message: the app's BookLoopMessagingService builds the notification,
            // so it looks identical to the local notification. HIGH priority = delivered quickly,
            // even when the phone is idle.
            Message message = Message.builder()
                    .setToken(token)
                    .putData("type", "order_status")
                    .putData("docId", firestoreId)
                    .putData("orderId", orderId != null ? orderId : firestoreId)
                    .putData("status", status)
                    .setAndroidConfig(AndroidConfig.builder()
                            .setPriority(AndroidConfig.Priority.HIGH)
                            .build())
                    .build();

            String messageId = FirebaseMessaging.getInstance().send(message);
            System.out.println("PUSH sent to user " + userId + " (status " + status
                    + ") messageId=" + messageId);
            return "sent";

        } catch (FirebaseMessagingException e) {
            System.err.println("PUSH failed: " + e.getMessage());

            // The phone's token is no longer valid (app uninstalled / token deleted):
            // remove it so we stop trying. The app saves a fresh one at next login.
            if (e.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED && userId != null) {
                try {
                    db.collection("users").document(userId)
                            .update("fcmToken", FieldValue.delete())
                            .get();
                    System.out.println("PUSH: removed stale token for user " + userId);
                } catch (Exception ignored) {
                    // best effort only
                }
            }
            return "failed (" + e.getMessage() + ")";

        } catch (Exception e) {
            System.err.println("PUSH error: " + e.getMessage());
            return "failed (" + e.getMessage() + ")";
        }
    }

    @OPTIONS public Response options() { return Response.ok().build(); }
    @OPTIONS @Path("/{id}/status") public Response optionsStatus() { return Response.ok().build(); }
}