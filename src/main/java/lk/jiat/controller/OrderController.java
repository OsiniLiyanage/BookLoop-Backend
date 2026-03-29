package lk.jiat.controller;

import com.google.cloud.firestore.*;
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
 *   PATCH /api/v1/orders/{id}/status        → update status
 *
 * Order statuses: CONFIRMED → PROCESSING → DELIVERED → RETURNED
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

            String status = (String) body.get("status");
            if (status == null || status.isEmpty()) {
                Map<String, Object> err = new HashMap<>();
                err.put("error", "status field required");
                return Response.status(Response.Status.BAD_REQUEST).entity(err).build();
            }

            db.collection("orders")
                    .document(firestoreId)
                    .update("status", status)
                    .get();

            Map<String, Object> result = new HashMap<>();
            result.put("message", "Order status updated to " + status);
            result.put("firestoreId", firestoreId);
            result.put("status", status);
            return Response.ok(result).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to update order: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    @OPTIONS public Response options() { return Response.ok().build(); }
    @OPTIONS @Path("/{id}/status") public Response optionsStatus() { return Response.ok().build(); }
}