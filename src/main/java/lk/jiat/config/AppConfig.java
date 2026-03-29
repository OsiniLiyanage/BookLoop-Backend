package lk.jiat.config;

import org.glassfish.jersey.server.ResourceConfig;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import javax.ws.rs.container.ContainerResponseFilter;
import javax.ws.rs.ext.Provider;
import java.io.IOException;

/*
 * AppConfig.java — Jersey configuration.
 *
 * WHY THIS FILE EXISTS:
 *   Jersey needs to know where your @Path controller classes are.
 *   packages("lk.jiat.controller") scans that package and registers everything
 *   that has @Path, @GET, @POST etc. annotations automatically.
 *
 * NOTE on imports:
 *   Jersey 2.x uses "javax.ws.rs.*" imports.
 *   Jersey 3.x uses "jakarta.ws.rs.*" imports.
 *   We use 2.x (matches Tomcat 10.1 + Java 11), so imports must be javax.*
 */
public class AppConfig extends ResourceConfig {

    public AppConfig() {
        // Scan lk.jiat.controller package for all @Path classes
        packages("lk.jiat.controller");

        // Register CORS filter so the browser HTML page can call the API
        register(CorsFilter.class);
    }

    /*
     * CorsFilter — adds CORS headers to every API response.
     *
     * WHY CORS MATTERS:
     *   When index.html (at http://localhost:8080) calls the API (also http://localhost:8080/api/v1),
     *   the browser considers this a cross-origin request and blocks it by default.
     *   This filter adds "Access-Control-Allow-Origin: *" to every response,
     *   telling the browser "this API is open to calls from any page."
     *
     *   For production you would restrict this to your actual domain,
     *   e.g. "Access-Control-Allow-Origin: https://admin.bookloop.lk"
     */
    @Provider
    public static class CorsFilter implements ContainerResponseFilter {
        @Override
        public void filter(ContainerRequestContext req, ContainerResponseContext res) throws IOException {
            res.getHeaders().add("Access-Control-Allow-Origin", "*");
            res.getHeaders().add("Access-Control-Allow-Headers",
                    "Origin, Content-Type, Accept, Authorization");
            res.getHeaders().add("Access-Control-Allow-Methods",
                    "GET, POST, PUT, DELETE, PATCH, OPTIONS");
        }
    }
}