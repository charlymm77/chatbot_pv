import axios from "axios";
import https from "https";

// Create an HTTPS agent that handles SSL certificate issues
const httpsAgent = new https.Agent({
  // Only disable certificate verification for this specific API
  // This is necessary because the external API has certificate chain issues
  rejectUnauthorized: false,
  // Enable server name indication
  servername: "aut-api.cloud"
});

async function getFacturasB64(token,path) {
  try {
    const response = await axios.post(
      "https://aut-api.cloud:82/getPdfL",
      {
        pathPdfLocal	:path
      },
      {
        headers: {
          Authorization: `Bearer ${token || "your-token-here"}`,
        },
        httpsAgent: httpsAgent,
        // Add timeout to prevent hanging requests
        timeout: 30000, // 30 seconds
      }
    );

    console.log("Factura obtenida exitosamente:", response.data ? "Data received" : "No data");
    // Return the PDF data from the response
    return response.data;
  } catch (error) {
    console.error("Error al obtener factura:", error.message);
    // Re-throw the error so calling code can handle it
    throw error;
  }
}

export { getFacturasB64 };
 