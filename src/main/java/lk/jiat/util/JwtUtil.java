package lk.jiat.util;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;

import java.util.Date;

/*
 * JwtUtil — generates a signed JWT token for admin sessions.
 *
 * JJWT VERSION NOTE:
 *   pom.xml uses jjwt 0.11.5 → uses the OLD builder API:
 *     .setSubject()    (not .subject())
 *     .setIssuedAt()   (not .issuedAt())
 *     .setExpiration() (not .expiration())
 *
 *   jjwt 0.12.x renamed all these (dropped the "set" prefix).
 *   If you see "cannot find symbol: method subject()" it means
 *   your code was written for 0.12.x but pom.xml has 0.11.5.
 */
public class JwtUtil {

    private static final String SECRET = "d5eGWVaqYRPTXKdAuri4uoBmmnCDnkFgpX0Eg1KGVbw=";

    public static String generateToken(String email) {
        return Jwts.builder()
                .setSubject(email)                                                    // 0.11.5 style
                .setIssuedAt(new Date())                                              // 0.11.5 style
                .setExpiration(new Date(System.currentTimeMillis() + 24 * 60 * 60 * 1000)) // 24 hours
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes()), SignatureAlgorithm.HS256)
                .compact();
    }
}