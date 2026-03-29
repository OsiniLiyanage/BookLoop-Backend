package lk.jiat.controller;

import com.google.cloud.firestore.*;
import lk.jiat.util.FirebaseUtil;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

import java.util.*;
import java.util.concurrent.ExecutionException;

/*
 * DashboardController — returns summary counts for the admin dashboard home page.
 * GET /api/v1/dashboard
 *
 * Returns a JSON object with:
 *   totalBooks, activeBooks, inactiveBooks,
 *   totalOrders, pendingOrders,
 *   totalUsers, totalCategories
 */
@Path("/dashboard")
@Produces(MediaType.APPLICATION_JSON)
public class DashboardController {

    @GET
    public Response getDashboardCounts() {
        try {
            Firestore db = FirebaseUtil.getFirestore();

            // Load all counts — these run sequentially (simple and reliable)
            int bookCount     = db.collection("products").get().get().size();
            int orderCount    = db.collection("orders").get().get().size();
            int userCount     = db.collection("users").get().get().size();
            int categoryCount = db.collection("categories").get().get().size();

            long activeBooks = db.collection("products")
                    .whereEqualTo("status", true).get().get().size();

            long pendingOrders;
            try {
                pendingOrders = db.collection("orders")
                        .whereEqualTo("status", "CONFIRMED").get().get().size();
            } catch (Exception e) {
                pendingOrders = 0; // index may not exist yet
            }

            Map<String, Object> counts = new HashMap<>();
            counts.put("totalBooks",      bookCount);
            counts.put("activeBooks",     activeBooks);
            counts.put("inactiveBooks",   bookCount - activeBooks);
            counts.put("totalOrders",     orderCount);
            counts.put("pendingOrders",   pendingOrders);
            counts.put("totalUsers",      userCount);
            counts.put("totalCategories", categoryCount);

            return Response.ok(counts).build();

        } catch (InterruptedException | ExecutionException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", "Failed to load dashboard: " + e.getMessage());
            return Response.serverError().entity(err).build();
        }
    }

    @OPTIONS public Response options() { return Response.ok().build(); }
}