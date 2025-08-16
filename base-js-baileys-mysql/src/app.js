import { join } from "path";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "fs";
import http from "http";
import https from "https";
import axios from "axios";
import dotenv from "dotenv";
import QRCode from "qrcode";

// Load environment variables
dotenv.config();
import {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  utils,
  MemoryDB,
} from "@builderbot/bot";
import { FixedMysqlAdapter as Database } from "./mysql-adapter-fixed.js";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { sendEmail } from "./emails.js";
import { getFacturasB64 } from "./facturas.js";
import {
  compressPDFToTarget,
  exceedsSize,
  getBufferSizeMB,
  isValidPDF,
  analyzePDF,
} from "./pdf-utils.js";

const PORT = process.env.PORT ?? 4009;

// Global QR storage
let currentQR = null;
let botConnected = false;

// SSL Configuration
const SSL_CONFIG = {
  enabled: process.env.SSL_ENABLED === "true",
  keyPath: process.env.SSL_KEY_PATH || "./certs/private-key.pem",
  certPath: process.env.SSL_CERT_PATH || "./certs/certificate.pem",
  caPath: process.env.SSL_CA_PATH || null, // Optional CA bundle path
};

const discordFlow = addKeyword("doc").addAnswer(
  [
    "You can see the documentation here",
    "📄 https://builderbot.app/docs \n",
    "Do you want to continue? *yes*",
  ].join("\n"),
  { capture: true },
  async (ctx, { gotoFlow, flowDynamic }) => {
    if (ctx.body.toLocaleLowerCase().includes("yes")) {
      return gotoFlow(registerFlow);
    }
    await flowDynamic("Thanks!");
    return;
  }
);

const welcomeFlow = addKeyword(["hi", "hello", "hola"])
  .addAnswer(`Bienvenido al chatBot 🤖  de PSA-SYSTEMS `)
  .addAnswer(
    [
      "Este fue creado con el proposito de brindar una solucion a los problemas de los clientes de PSA-SYSTEMS",
      "",
    ].join("\n"),
    { delay: 800, capture: true },
    async (ctx, { fallBack }) => {
      if (!ctx.body.toLocaleLowerCase().includes("doc")) {
        return fallBack("You should type *doc*");
      }
      return;
    },
    [discordFlow]
  );
const responseFlowByChat = addKeyword([
  "ok",
  "ook",
  "OK",
  "oc",
  "OC",
  "si",
  "Si",
  "SI",
  "esta bien",
  "Esta bien",
  "ESTA BIEN",
  "muy bien",
  "Muy Bien",
  "Muy bien",
  "muy Bien",
  "MUY BIEN",
])
  .addAnswer(`logo`, {
    media: join(process.cwd(), "assets", "psa.png"),
  })
  .addAnswer(`Bienvenido al chatBot 🤖  de PSA-SYSTEMS `)
  .addAnswer([
    "El usuario no se dará cuenta del mensaje que acabas de mandar porque es un chatbot del sistema Punto de Venta de PSA-SYSTEMS. Contactate directamente con el usuario.",
    "",
  ]);

const registerFlow = addKeyword(utils.setEvent("REGISTER_FLOW"))
  .addAnswer(
    `What is your name?`,
    { capture: true },
    async (ctx, { state }) => {
      await state.update({ name: ctx.body });
    }
  )
  .addAnswer("What is your age?", { capture: true }, async (ctx, { state }) => {
    await state.update({ age: ctx.body });
  })
  .addAction(async (_, { flowDynamic, state }) => {
    await flowDynamic(
      `${state.get(
        "name"
      )}, thanks for your information!: Your age: ${state.get("age")}`
    );
  });

const fullSamplesFlow = addKeyword(["samples", utils.setEvent("SAMPLES")])
  .addAnswer(`💪 I'll send you a lot files...`)
  .addAnswer(`Send image from Local`, {
    media: join(process.cwd(), "assets", "sample.png"),
  })
  .addAnswer(`Send video from URL`, {
    media:
      "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTJ0ZGdjd2syeXAwMjQ4aWdkcW04OWlqcXI3Ynh1ODkwZ25zZWZ1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LCohAb657pSdHv0Q5h/giphy.mp4",
  })
  .addAnswer(`Send audio from URL`, {
    media: "https://cdn.freesound.org/previews/728/728142_11861866-lq.mp3",
  })
  .addAnswer(`Send file from URL`, {
    media:
      "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
  });

const main = async () => {
  ///Registro de los flujos
  const adapterFlow = createFlow([
    welcomeFlow,
    registerFlow,
    fullSamplesFlow,
    responseFlowByChat,
  ]);

  const adapterProvider = createProvider(Provider);
  // Enhanced database configuration with connection pooling
  const adapterDB = new Database({
    host: process.env.MYSQL_DB_HOST,
    port: process.env.MYSQL_DB_PORT || 3306,
    user: process.env.MYSQL_DB_USER,
    database: process.env.MYSQL_DB_NAME,
    password: process.env.MYSQL_DB_PASSWORD,
    connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT) || 10,
    acquireTimeout: parseInt(process.env.MYSQL_ACQUIRE_TIMEOUT) || 60000,
    timeout: 60000,
    multipleStatements: false,
    charset: "utf8mb4",
    timezone: "local",
    ssl: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: false,
    debug: false,
    trace: false,
    stringifyObjects: false,
    typeCast: true,
  });

  // Function to load SSL certificates
  const loadSSLCertificates = () => {
    try {
      console.log(`📄 Reading key file: ${SSL_CONFIG.keyPath}`);
      if (!existsSync(SSL_CONFIG.keyPath)) {
        throw new Error(`Key file not found: ${SSL_CONFIG.keyPath}`);
      }

      console.log(`📄 Reading cert file: ${SSL_CONFIG.certPath}`);
      if (!existsSync(SSL_CONFIG.certPath)) {
        throw new Error(`Certificate file not found: ${SSL_CONFIG.certPath}`);
      }

      const sslOptions = {
        key: readFileSync(SSL_CONFIG.keyPath),
        cert: readFileSync(SSL_CONFIG.certPath),
      };

      // Add CA bundle if specified
      if (SSL_CONFIG.caPath && existsSync(SSL_CONFIG.caPath)) {
        console.log(`📄 Reading CA bundle: ${SSL_CONFIG.caPath}`);
        sslOptions.ca = readFileSync(SSL_CONFIG.caPath);
      } else if (SSL_CONFIG.caPath) {
        console.warn(`⚠️  CA bundle file not found: ${SSL_CONFIG.caPath}`);
      }

      return sslOptions;
    } catch (error) {
      console.error("❌ Error loading SSL certificates:", error.message);
      console.error("Make sure the certificate files exist at:");
      console.error("- Key:", SSL_CONFIG.keyPath);
      console.error("- Cert:", SSL_CONFIG.certPath);
      if (SSL_CONFIG.caPath) console.error("- CA:", SSL_CONFIG.caPath);
      throw error;
    }
  };

  const { handleCtx, httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  // Override the error handler to fix PayloadTooLargeError issue
  if (adapterProvider.server && adapterProvider.server.onError) {
    const originalOnError = adapterProvider.server.onError;
    adapterProvider.server.onError = (err, req, res, next) => {
      console.log("🔧 Custom error handler triggered:", err.name, err.message);
      let code = (res.statusCode = err.code || err.status || 500);
      // Make sure we always pass a string to res.end()
      const errorMessage =
        err.message || http.STATUS_CODES[code] || "Unknown Error";
      const responseMessage =
        typeof errorMessage === "string"
          ? errorMessage
          : JSON.stringify(errorMessage);
      res.end(responseMessage);
    };
    console.log(
      "✅ Custom error handler installed to fix PayloadTooLargeError"
    );
  }

  // Configure very high payload limits immediately after bot creation
  const maxPayloadMB = parseInt(process.env.MAX_PAYLOAD_SIZE_MB) || 200;
  const serverMaxPayloadMB = maxPayloadMB * 10; // 10x the business limit for safety
  const serverMaxPayloadBytes = serverMaxPayloadMB * 1024 * 1024;

  // Try to configure the underlying server with very high limits
  if (adapterProvider.server && adapterProvider.server.server) {
    const server = adapterProvider.server.server;

    // Set very high limits on the HTTP server
    server.maxRequestSize = serverMaxPayloadBytes;
    server.maxHeadersCount = 0;
    server.timeout = 600000; // 10 minutes
    server.keepAliveTimeout = 600000;
    server.headersTimeout = 600000;

    console.log(`🔧 HTTP server configured with ${serverMaxPayloadMB}MB limit`);
  }

  // Configure Express-like middleware if available
  if (adapterProvider.server && adapterProvider.server.use) {
    // Add body parser with very high limits
    try {
      adapterProvider.server.use((req, res, next) => {
        // Set very high limits for this request
        req.setTimeout(600000);
        res.setTimeout(600000);

        // Override default payload limit handling
        if (req.url === "/v1/messages") {
          req._maxListeners = 0;
          req.maxHeadersCount = 0;
        }

        next();
      });

      console.log(`🔧 Middleware configured for large payloads`);
    } catch (error) {
      console.log(`⚠️ Could not configure middleware:`, error.message);
    }
  }

  // Server limits already configured above after bot creation

  // Create a separate HTTP server for handling large payloads
  const http = await import("http");
  const largePayloadServer = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/v1/messages-large") {
      console.log("📨 Received large payload request");

      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      let body = "";
      let totalSize = 0;
      const maxSize = 2000 * 1024 * 1024; // 2GB limit

      req.on("data", (chunk) => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "error",
              message: "Payload too large even for large payload handler",
              maxSize: "2000MB",
            })
          );
          return;
        }
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          console.log(
            `📊 Large payload received: ${Math.round(
              totalSize / 1024 / 1024
            )}MB`
          );

          const data = JSON.parse(body);
          const { number, message, pdf, xml, customerName } = data;

          // Get payload size limits
          const maxPayloadMB = parseInt(process.env.MAX_PAYLOAD_SIZE_MB) || 200;
          const totalBodySizeMB = totalSize / 1024 / 1024;

          // Check if PDF is a URL that we can still send
          const isValidURL = (str) => {
            try {
              const url = new URL(str);
              return url.protocol === "http:" || url.protocol === "https:";
            } catch (err) {
              return false;
            }
          };

          const isPdfURL = pdf && isValidURL(pdf);
          const skipPDF = !isPdfURL; // Only skip if it's not a URL

          let payloadTooLargeMessage = "";
          if (skipPDF) {
            payloadTooLargeMessage = `\n\n⚠️ NOTA: El PDF no pudo ser enviado debido a que el archivo es demasiado grande (${totalBodySizeMB.toFixed(
              2
            )}MB > ${maxPayloadMB}MB). Por favor, comprima el archivo o envíelo por otro medio.`;
            console.log(
              `⚠️ Large payload handler: skipping PDF (${totalBodySizeMB.toFixed(
                2
              )}MB)`
            );
          } else if (isPdfURL) {
            payloadTooLargeMessage = `\n\n📄 Documento PDF disponible en: ${pdf}`;
            console.log(`🔗 Large payload handler: sending PDF as URL`);
          }

          // Create a mock request/response to use with handleCtx
          const mockReq = { body: { number, message, xml, customerName } };
          const mockRes = {
            writeHead: () => {},
            end: () => {},
            status: 200,
            data: null,
          };

          // Use the handleCtx function to get proper bot instance
          const handler = handleCtx(async (bot, req, res) => {
            // Send message without PDF
            let finalMessage =
              message && message.trim() !== ""
                ? message
                : "Adjunto el XML de la factura para que puedas verla";
            finalMessage += payloadTooLargeMessage;

            await bot.sendMessage(number, finalMessage, { media: null });

            return { success: true };
          });

          const result = await handler(mockReq, mockRes);

          // Send XML and footer using the same pattern
          if (xml) {
            const xmlHandler = handleCtx(async (bot, req, res) => {
              const timestamp = Date.now();
              const xmlFileName = `temp_xml_${timestamp}.xml`;
              const xmlFilePath = join(process.cwd(), xmlFileName);

              try {
                const isValidBase64 = (str) => {
                  try {
                    return (
                      Buffer.from(str, "base64").toString("base64") === str
                    );
                  } catch (err) {
                    return false;
                  }
                };

                let xmlContent = isValidBase64(xml)
                  ? Buffer.from(xml, "base64").toString("utf8")
                  : xml;

                writeFileSync(xmlFilePath, xmlContent, {
                  encoding: "utf8",
                  flag: "w",
                });
                await bot.sendMessage(number, "", { media: xmlFilePath });

                if (existsSync(xmlFilePath)) {
                  unlinkSync(xmlFilePath);
                }
              } catch (xmlError) {
                console.error("Error sending XML:", xmlError);
                if (existsSync(xmlFilePath)) {
                  unlinkSync(xmlFilePath);
                }
              }

              return { success: true };
            });

            await xmlHandler(mockReq, mockRes);
          }

          // Send footer message
          const footerHandler = handleCtx(async (bot, req, res) => {
            let footerMessage = "━━━━━━━━━━━━━━━━━━━━━━━\n";
            footerMessage += "📧 Enviado desde PSA-SYSTEMS\n";
            footerMessage += "🏢 Sistema de Punto de Venta Profesional\n\n";
            if (customerName) {
              footerMessage += `👤 Enviado por: ${customerName}\n\n`;
            }
            footerMessage +=
              "🌐 Más información: https://psa-systems.com/#/home\n";
            footerMessage += "━━━━━━━━━━━━━━━━━━━━━━━";

            await bot.sendMessage(number, footerMessage, { media: null });
            return { success: true };
          });

          await footerHandler(mockReq, mockRes);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "partial_success",
              message: `Mensaje enviado exitosamente a ${number} (PDF omitido por tamaño)`,
              method: "whatsapp",
              warning: "PDF omitido debido al tamaño del payload",
              pdfSkipped: true,
              payloadSize: `${totalBodySizeMB.toFixed(2)}MB`,
              maxAllowed: `${maxPayloadMB}MB`,
            })
          );
        } catch (error) {
          console.error("Error in large payload handler:", error);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "error",
              message: `Error processing large payload: ${error.message}`,
            })
          );
        }
      });

      req.on("error", (error) => {
        console.error("Request error in large payload handler:", error);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "error",
            message: `Request error: ${error.message}`,
          })
        );
      });
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "error", message: "Not found" }));
    }
  });

  // Start the large payload server on a different port
  const largePayloadPort = 4010;
  largePayloadServer.listen(largePayloadPort, () => {
    console.log(`🚀 Large payload server running on port ${largePayloadPort}`);
    console.log(
      `📡 Large payload endpoint: http://localhost:${largePayloadPort}/v1/messages-large`
    );
  });

  largePayloadServer.on("error", (error) => {
    console.error("Large payload server error:", error);
  });

  // Event listeners para capturar QR y estado de conexión
  adapterProvider.on("qr", (qr) => {
    console.log("📱 QR Code generated");
    currentQR = qr;
    botConnected = false;
  });

  adapterProvider.on("ready", () => {
    console.log("✅ Bot connected to WhatsApp");
    currentQR = null;
    botConnected = true;
  });

  adapterProvider.on("auth_failure", () => {
    console.log("❌ Authentication failed");
    currentQR = null;
    botConnected = false;
  });

  adapterProvider.on("disconnected", () => {
    console.log("⚠️ Bot disconnected from WhatsApp");
    botConnected = false;
  });

  // También escuchar eventos del proveedor interno
  if (adapterProvider.vendor && adapterProvider.vendor.ev) {
    adapterProvider.vendor.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("📱 QR Code generated from vendor");
        currentQR = qr;
        botConnected = false;
      }

      if (connection === "close") {
        console.log("⚠️ Connection closed");
        botConnected = false;
      } else if (connection === "open") {
        console.log("✅ Connection opened");
        currentQR = null;
        botConnected = true;
      }
    });
  }

  adapterProvider.server.post(
    "/v1/messages",
    handleCtx(async (bot, req, res) => {
      try {
     


  
        const { number, message, xml, customerName,token,path } = req.body;

   

     




        // Si el mensaje es null o vacío, usar un mensaje predeterminado
        let finalMessage =
          message && message.trim() !== ""
            ? message
            : "Adjunto el PDF Y XML de la factura para que puedas verla";

     
        // Función para validar si el bot está conectado

        // Si el bot está conectado, continuar con el flujo normal
        ///Enviamos el mensaje al contacto
        await bot.sendMessage(number, finalMessage, {
          media: null,
        });

        try {
          // Si hay un PDF 
          if (!token || !path || !number) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(
              JSON.stringify({
                status: "error",
                message: "Missing required fields: token, path, or number",
              })
            );
          }
  
          console.log(`📄 Fetching PDF from external API...`);
  
          const timestamp = Date.now();
          const pdfFileName = `factura_pdf_${timestamp}.pdf`;
          const pdfFilePath = join(process.cwd(), pdfFileName);
  
          // Get PDF data from external API
          const pdfData = await getFacturasB64(token, path);
          
          if (!pdfData) {
            throw new Error("No PDF data received from external API");
          }
  
          // Check if the response contains base64 PDF data
          let pdfBase64;
          if (typeof pdfData === 'string') {
            pdfBase64 = pdfData;
          } else if (pdfData.pdf || pdfData.data) {
            pdfBase64 = pdfData.pdf || pdfData.data;
          } else {
            console.log("PDF Data structure:", pdfData);
            throw new Error("Unable to extract PDF data from response");
          }
  
          // Decodificar el base64
          const pdfBuffer = Buffer.from(pdfBase64, "base64");
          console.log(
            `📄 PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`
          );
  
          // Guardar el PDF como archivo temporal
          writeFileSync(pdfFilePath, pdfBuffer);
          console.log(
            `💾 PDF ready to send: ${(
              pdfBuffer.length /
              1024 /
              1024
            ).toFixed(2)} MB`
          );
  
          // Enviar el archivo PDF
          await bot.sendMessage(number, "", {
            media: pdfFilePath,
          });
  
          // Borrar el archivo temporal después del envío
          if (existsSync(pdfFilePath)) {
            unlinkSync(pdfFilePath);
          }
        
          // Si hay un XML en base64, procesarlo
          if (xml) {
            // Generar nombre único para el archivo temporal
            const timestamp = Date.now();
            const xmlFileName = `factura_xml_${timestamp}.xml`;
            const xmlFilePath = join(process.cwd(), xmlFileName);

            try {
              // Validar y procesar el contenido XML
              let xmlContent;

              // Función para validar si es base64 válido
              const isValidBase64 = (str) => {
                try {
                  return Buffer.from(str, "base64").toString("base64") === str;
                } catch (err) {
                  return false;
                }
              };

              // Verificar si el contenido es base64 válido
              if (isValidBase64(xml)) {
                try {
                  const decodedBuffer = Buffer.from(xml, "base64");
                  xmlContent = decodedBuffer.toString("utf8");

                  // Validar que el contenido decodificado sea XML válido
                  if (
                    !xmlContent.trim().startsWith("<?xml") &&
                    !xmlContent.trim().startsWith("<")
                  ) {
                    throw new Error(
                      "El contenido decodificado no parece ser XML válido"
                    );
                  }
                } catch (error) {
                  console.error("Error decodificando base64:", error);
                  throw new Error(
                    "El contenido base64 no se pudo decodificar correctamente"
                  );
                }
              } else {
                // Si no es base64, asumir que es texto plano XML
                xmlContent = xml;

                // Validar que sea XML válido
                if (
                  !xmlContent.trim().startsWith("<?xml") &&
                  !xmlContent.trim().startsWith("<")
                ) {
                  throw new Error("El contenido no parece ser XML válido");
                }
              }

              // Guardar el archivo con encoding UTF-8 sin BOM
              writeFileSync(xmlFilePath, xmlContent, {
                encoding: "utf8",
                flag: "w",
              });

              // Enviar el archivo XML
              await bot.sendMessage(number, "", {
                media: xmlFilePath,
              });

              // Borrar el archivo temporal después del envío
              if (existsSync(xmlFilePath)) {
                unlinkSync(xmlFilePath);
              }
            } catch (xmlError) {
              const errorDetails = `
              Endpoint: /v1/messages
              Timestamp: ${new Date().toISOString()}
              Error: ${xmlError.message}
              Stack: ${xmlError.stack}
              Request Body: ${JSON.stringify(req.body, null, 2)}
            `;
              await sendEmail(
                "Error crítico en CHATBOT - Endpoint /v1/messages",
                errorDetails,
                `
              <h2>Error en el Sistema de CHATBOT</h2>
              <p><strong>Endpoint:</strong> /v1/messages</p>
              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
              <p><strong>Error:</strong> ${xmlError.message}</p>
              <p><strong>Request Body:</strong></p>
              <pre>${JSON.stringify(req.body, null, 2)}</pre>
              <p><strong>Stack Trace:</strong></p>
              <pre>${xmlError.stack}</pre>
            `
              );
              console.error("Error procesando XML:", xmlError);
              // Limpiar archivo si existe en caso de error
              if (existsSync(xmlFilePath)) {
                unlinkSync(xmlFilePath);
              }
              throw xmlError;
            }
          }

          // El mensaje inicial ya fue enviado arriba, no necesitamos enviarlo de nuevo

          // Mensaje profesional consolidado
          let footerMessage = "━━━━━━━━━━━━━━━━━━━━━━━\n";
          footerMessage += "📧 Enviado desde PSA-SYSTEMS\n";
          footerMessage += "🏢 Sistema de Punto de Venta Profesional\n\n";

          if (customerName) {
            footerMessage += `👤 Enviado por: ${customerName}\n\n`;
          }

          footerMessage +=
            "🌐 Más información: https://psa-systems.com/#/home\n";
          footerMessage += "━━━━━━━━━━━━━━━━━━━━━━━";

          await bot.sendMessage(number, footerMessage, {
            media: null,
          });

          // Prepare response with appropriate status
          const responseData = {
            status: "ok",
            message: `Mensaje enviado exitosamente a ${number}`,
            method: "whatsapp",
          };

     

          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify(responseData));
        } catch (error) {
          console.error("Error enviando mensaje:", error);


     
          res.writeHead(500, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              status: "error",
              message: `Error enviando mensaje: ${error.message}`,
              payloadSize: ``,
              maxAllowed: ``,
            })
          );
        }
      } catch (error) {
        console.error("Main error handler for /v1/messages:", error);

    
      }
    })
  );


  adapterProvider.server.post(
    "/v1/factura",
    handleCtx(async (bot, req, res) => {
      try {
        const { token, path, number } = req.body;

        if (!token || !path || !number) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              status: "error",
              message: "Missing required fields: token, path, or number",
            })
          );
        }

        console.log(`📄 Fetching PDF from external API...`);

        const timestamp = Date.now();
        const pdfFileName = `factura_pdf_${timestamp}.pdf`;
        const pdfFilePath = join(process.cwd(), pdfFileName);

        // Get PDF data from external API
        const pdfData = await getFacturasB64(token, path);
        
        if (!pdfData) {
          throw new Error("No PDF data received from external API");
        }

        // Check if the response contains base64 PDF data
        let pdfBase64;
        if (typeof pdfData === 'string') {
          pdfBase64 = pdfData;
        } else if (pdfData.pdf || pdfData.data) {
          pdfBase64 = pdfData.pdf || pdfData.data;
        } else {
          console.log("PDF Data structure:", pdfData);
          throw new Error("Unable to extract PDF data from response");
        }

        // Decodificar el base64
        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        console.log(
          `📄 PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`
        );

        // Guardar el PDF como archivo temporal
        writeFileSync(pdfFilePath, pdfBuffer);
        console.log(
          `💾 PDF ready to send: ${(
            pdfBuffer.length /
            1024 /
            1024
          ).toFixed(2)} MB`
        );

        // Enviar el archivo PDF
        await bot.sendMessage(number, "", {
          media: pdfFilePath,
        });

        // Borrar el archivo temporal después del envío
        if (existsSync(pdfFilePath)) {
          unlinkSync(pdfFilePath);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "success",
            message: `PDF enviado exitosamente a ${number}`,
            method: "whatsapp",
          })
        );

      } catch (error) {
        console.error("Error in /v1/factura endpoint:", error);
        
        // Clean up file if it exists
        const timestamp = Date.now();
        const pdfFileName = `factura_pdf_${timestamp}.pdf`;
        const pdfFilePath = join(process.cwd(), pdfFileName);
        if (existsSync(pdfFilePath)) {
          unlinkSync(pdfFilePath);
        }

        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "error",
            message: `Error procesando factura: ${error.message}`,
          })
        );
      }
    })
  );

  adapterProvider.server.post(
    "/v1/register",
    handleCtx(async (bot, req, res) => {
      const { number, name } = req.body;
      await bot.dispatch("REGISTER_FLOW", { from: number, name });
      return res.end("trigger");
    })
  );

  adapterProvider.server.post(
    "/v1/samples",
    handleCtx(async (bot, req, res) => {
      const { number, name } = req.body;
      await bot.dispatch("SAMPLES", { from: number, name });
      return res.end("trigger");
    })
  );

  adapterProvider.server.post(
    "/v1/blacklist",
    handleCtx(async (bot, req, res) => {
      const { number, intent } = req.body;
      if (intent === "remove") bot.blacklist.remove(number);
      if (intent === "add") bot.blacklist.add(number);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", number, intent }));
    })
  );

  // Test endpoint to check payload limits
  adapterProvider.server.post(
    "/v1/test-payload",
    handleCtx(async (bot, req, res) => {
      try {
        const maxPayloadMB = parseInt(process.env.MAX_PAYLOAD_SIZE_MB) || 100;
        const bodySize = Buffer.byteLength(JSON.stringify(req.body), "utf8");

        console.log(
          `🧪 Test payload received: ${Math.round(bodySize / 1024)}KB`
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "ok",
            message: "Payload received successfully",
            receivedSize: `${Math.round(bodySize / 1024)}KB`,
            maxAllowed: `${maxPayloadMB}MB`,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (error) {
        console.error("Error in test payload endpoint:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "error",
            message: error.message,
          })
        );
      }
    })
  );

  // Ruta principal para mostrar el QR code en el navegador
  adapterProvider.server.get("/", async (req, res) => {
    try {
      // Intentar obtener el QR de diferentes fuentes
      const qrCode =
        currentQR ||
        adapterProvider.qr ||
        (adapterProvider.vendor && adapterProvider.vendor.qr);
      const isConnected =
        botConnected ||
        (adapterProvider.vendor &&
          adapterProvider.vendor.ws &&
          adapterProvider.vendor.ws.readyState === 1);

      let html = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>PSA-SYSTEMS ChatBot - WhatsApp Connection</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 20px;
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .container {
              background: white;
              border-radius: 20px;
              padding: 40px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 500px;
              width: 100%;
            }
            .logo {
              font-size: 2.5em;
              color: #667eea;
              margin-bottom: 10px;
            }
            .title {
              color: #333;
              margin-bottom: 30px;
              font-size: 1.5em;
            }
            .status {
              padding: 15px;ç
              border-radius: 10px;
              margin: 20px 0;
              font-weight: bold;
            }
            .connected {
              background: #d4edda;
              color: #155724;
              border: 1px solid #c3e6cb;
            }
            .disconnected {
              background: #f8d7da;
              color: #721c24;
              border: 1px solid #f5c6cb;
            }
            .qr-container {
              margin: 30px 0;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 15px;
            }
            .qr-code {
              font-family: monospace;
              font-size: 12px;
              line-height: 1;
              white-space: pre;
              background: white;
              padding: 20px;
              border-radius: 10px;
              margin: 20px 0;
              overflow: auto;
              max-height: 400px;
            }
            .instructions {
              background: #e3f2fd;
              padding: 20px;
              border-radius: 10px;
              margin: 20px 0;
              text-align: left;
            }
            .refresh-btn {
              background: #667eea;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 25px;
              cursor: pointer;
              font-size: 16px;
              margin: 10px;
              transition: background 0.3s;
            }
            .refresh-btn:hover {
              background: #5a6fd8;
            }
            .api-info {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 10px;
              margin-top: 20px;
              font-size: 14px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">🤖</div>
            <h1 class="title">PSA-SYSTEMS ChatBot</h1>
            <p>WhatsApp Bot Connection Status</p>
      `;

      if (isConnected) {
        html += `
            <div class="status connected">
              ✅ Bot conectado a WhatsApp
            </div>
            <p>El bot está funcionando correctamente y listo para recibir mensajes.</p>
        `;
      } else if (qrCode) {
        // Convertir QR a formato visual usando caracteres
        // Generar QR como imagen base64
        const qrImageBase64 = await QRCode.toDataURL(qrCode, {
          width: 300,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });

        html += `
            <div class="status disconnected">
              ⏳ Bot desconectado - Escanea el código QR
            </div>
            <div class="qr-container">
              <h3>Código QR para WhatsApp</h3>
              <img src="${qrImageBase64}" alt="QR Code" style="max-width: 300px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" />
            </div>
            <div class="instructions">
              <h4>📱 Instrucciones:</h4>
              <ol>
                <li>Abre WhatsApp en tu teléfono</li>
                <li>Ve a <strong>Configuración > Dispositivos vinculados</strong></li>
                <li>Toca <strong>"Vincular un dispositivo"</strong></li>
                <li>Escanea el código QR de arriba</li>
              </ol>
            </div>
        `;
      } else {
        html += `
            <div class="status disconnected">
              ⏳ Inicializando bot...
            </div>
            <p>El bot se está inicializando. El código QR aparecerá en unos momentos.</p>
        `;
      }

      html += `
            <button class="refresh-btn" onclick="window.location.reload()">🔄 Actualizar</button>
            
            <div class="api-info">
              <strong>API Endpoints disponibles:</strong><br>
              • GET /v1/qr - Obtener QR en JSON<br>
              • GET /v1/status - Estado de conexión<br>
              • POST /v1/messages - Enviar mensajes (con compresión automática de PDF)<br>
              • POST /v1/register - Registrar usuario<br>
              • POST /v1/blacklist - Gestionar lista negra<br>
              • POST /v1/test-payload - Probar límites de payload<br>
              • POST /v1/test-compression - Probar compresión de PDF<br>
              • GET /v1/db-health - Estado de la base de datos<br>
              <br>
              <strong>Configuración actual:</strong><br>
              • Límite máximo de payload (middleware): 250MB<br>
              • Límite de PDF (business logic): ${maxPayloadMB}MB<br>
              • Compresión automática de PDF: ❌ Desactivada<br>
              • Los PDFs se envían sin modificaciones
            </div>
          </div>
          
          <script>
            // Auto-refresh cada 5 segundos si no está conectado
            ${
              !isConnected
                ? "setTimeout(() => window.location.reload(), 5000);"
                : ""
            }
          </script>
        </body>
        </html>
      `;

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(html);
    } catch (error) {
      console.error("Error showing QR page:", error);
      res.writeHead(500, { "Content-Type": "text/html" });
      return res.end(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>❌ Error</h1>
            <p>Error interno del servidor al mostrar la página del QR</p>
            <button onclick="window.location.reload()">🔄 Reintentar</button>
          </body>
        </html>
      `);
    }
  });

  // Ruta para obtener el código QR
  adapterProvider.server.get("/v1/qr", (req, res) => {
    try {
      const qrCode =
        currentQR ||
        adapterProvider.qr ||
        (adapterProvider.vendor && adapterProvider.vendor.qr);

      if (!qrCode) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "error",
            message:
              "QR code not available. Bot might already be connected or still initializing.",
          })
        );
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          status: "success",
          qr: qrCode,
          message: "Scan this QR code with WhatsApp to connect the bot",
        })
      );
    } catch (error) {
      console.error("Error getting QR code:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          status: "error",
          message: "Internal server error while getting QR code",
        })
      );
    }
  });

  // Ruta para obtener el estado de conexión del bot
  adapterProvider.server.get("/v1/status", (req, res) => {
    try {
      const isConnected =
        botConnected ||
        (adapterProvider.vendor &&
          adapterProvider.vendor.ws &&
          adapterProvider.vendor.ws.readyState === 1);
      const qrAvailable = !!(
        currentQR ||
        adapterProvider.qr ||
        (adapterProvider.vendor && adapterProvider.vendor.qr)
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          status: "success",
          connected: isConnected,
          qrAvailable: qrAvailable,
          message: isConnected
            ? "Bot is connected to WhatsApp"
            : "Bot is not connected to WhatsApp",
        })
      );
    } catch (error) {
      console.error("Error getting bot status:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          status: "error",
          message: "Internal server error while getting bot status",
        })
      );
    }
  });

  // Test endpoint for large payloads
  adapterProvider.server.post(
    "/v1/test-payload",
    handleCtx(async (bot, req, res) => {
      try {
        const bodySize = JSON.stringify(req.body).length;
        console.log(
          `🧪 Test payload received: ${Math.round(bodySize / 1024)}KB`
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "success",
            message: "Payload received successfully",
            size: `${Math.round(bodySize / 1024)}KB`,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (error) {
        console.error("❌ Test payload error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "error",
            message: error.message,
          })
        );
      }
    })
  );

  // Test endpoint for PDF compression
  adapterProvider.server.post(
    "/v1/test-compression",
    handleCtx(async (bot, req, res) => {
      try {
        console.log(`🧪 PDF compression test started`);
        const { pdf } = req.body;

        if (!pdf) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              status: "error",
              message: "PDF content is required in base64 format",
            })
          );
        }

        // Validate base64
        const isValidBase64 = (str) => {
          try {
            return Buffer.from(str, "base64").toString("base64") === str;
          } catch (err) {
            return false;
          }
        };

        if (!isValidBase64(pdf)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              status: "error",
              message: "Invalid base64 PDF content",
            })
          );
        }

        const pdfBuffer = Buffer.from(pdf, "base64");

        if (!isValidPDF(pdfBuffer)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              status: "error",
              message: "Invalid PDF format",
            })
          );
        }

        // Analyze PDF
        const analysis = await analyzePDF(pdfBuffer);
        console.log(`📊 PDF Analysis:`, analysis);

        // Compress PDF
        const startTime = performance.now();
        const compressedBuffer = await compressPDFToTarget(pdfBuffer, 25);
        const compressionTime = performance.now() - startTime;

        const originalSizeMB = getBufferSizeMB(pdfBuffer);
        const compressedSizeMB = getBufferSizeMB(compressedBuffer);
        const compressionRatio = (
          ((originalSizeMB - compressedSizeMB) / originalSizeMB) *
          100
        ).toFixed(1);
        const isValid = isValidPDF(compressedBuffer);
        const targetAchieved = compressedSizeMB <= 25;

        console.log(`✅ Compression test completed:`);
        console.log(`   - Original: ${originalSizeMB.toFixed(2)} MB`);
        console.log(`   - Compressed: ${compressedSizeMB.toFixed(2)} MB`);
        console.log(`   - Reduction: ${compressionRatio}%`);
        console.log(`   - Valid: ${isValid}`);
        console.log(`   - Target achieved: ${targetAchieved}`);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "success",
            analysis: {
              size: analysis.size,
              pages: analysis.pages,
              hasImages: analysis.hasImages,
              hasAnnotations: analysis.hasAnnotations,
              compressionStrategy: analysis.compressionStrategy,
            },
            compression: {
              originalSize: `${originalSizeMB.toFixed(2)} MB`,
              compressedSize: `${compressedSizeMB.toFixed(2)} MB`,
              compressionRatio: `${compressionRatio}%`,
              processingTime: `${compressionTime.toFixed(2)}ms`,
              isValid: isValid,
              targetAchieved: targetAchieved,
            },
            compressedPdf: compressedBuffer.toString("base64"),
            timestamp: new Date().toISOString(),
          })
        );
      } catch (error) {
        console.error("❌ PDF compression test error:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "error",
            message: error.message,
            timestamp: new Date().toISOString(),
          })
        );
      }
    })
  );

  // Database health check endpoint
  adapterProvider.server.get("/v1/db-health", async (req, res) => {
    try {
      console.log("🔍 Checking database health...");

      // Test database connection by trying to get a simple query
      await adapterDB.getPrevByNumber("health-check");

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          status: "success",
          message: "Database connection is healthy",
          timestamp: new Date().toISOString(),
          database: {
            host: process.env.MYSQL_DB_HOST,
            port: process.env.MYSQL_DB_PORT,
            database: process.env.MYSQL_DB_NAME,
            user: process.env.MYSQL_DB_USER,
          },
        })
      );
    } catch (error) {
      console.error("❌ Database health check failed:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          status: "error",
          message: `Database connection failed: ${error.message}`,
          timestamp: new Date().toISOString(),
          error: {
            name: error.name,
            code: error.code,
            sqlState: error.sqlState,
          },
        })
      );
    }
  });

  // Configure the underlying HTTP server for large payloads
  if (httpServer && typeof httpServer === "function") {
    // Get the server instance after it's created
    const serverInstance = httpServer(+PORT);

    // Configure the HTTP server for large payloads
    if (serverInstance && serverInstance.on) {
      serverInstance.on("connection", (socket) => {
        socket.setTimeout(600000); // 10 minutes
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 60000);
      });

      serverInstance.on("request", (req, res) => {
        req.setTimeout(600000); // 10 minutes
        res.setTimeout(600000);
      });

      console.log("✅ HTTP server configured for large payloads");
    }
  } else {
    // Fallback: just start the server normally
    httpServer(+PORT);
  }

  // Start server with HTTPS if SSL is enabled
  console.log(`SSL Configuration:`);
  console.log(`- SSL_ENABLED: ${process.env.SSL_ENABLED}`);
  console.log(`- SSL Enabled: ${SSL_CONFIG.enabled}`);
  console.log(`- Key Path: ${SSL_CONFIG.keyPath}`);
  console.log(`- Cert Path: ${SSL_CONFIG.certPath}`);
  console.log(`- CA Path: ${SSL_CONFIG.caPath}`);

  if (SSL_CONFIG.enabled) {
    try {
      console.log("🔐 Loading SSL certificates...");
      const sslOptions = loadSSLCertificates();
      console.log("✅ SSL certificates loaded successfully");

      // Create the HTTPS server with large payload support
      const httpsServer = https.createServer(
        sslOptions,
        adapterProvider.server.handler
      );

      // Configure HTTPS server for large payloads
      httpsServer.on("connection", (socket) => {
        socket.setTimeout(600000); // 10 minutes
        socket.setNoDelay(true);
        socket.setKeepAlive(true, 60000);
      });

      httpsServer.on("request", (req, res) => {
        req.setTimeout(600000); // 10 minutes
        res.setTimeout(600000);
      });

      const httpsPort = 4008; // Puerto 4008 para HTTPS
      httpsServer.listen(httpsPort, () => {
        console.log(`🔐 HTTPS Server running on port ${httpsPort}`);
        console.log(`🔗 HTTPS URL: https://localhost:${httpsPort}`);
        console.log(
          `🌐 HTTP URL: http://localhost:${PORT} (for QR generation)`
        );
        console.log(`📱 QR Code available at both URLs`);
        console.log(
          `📊 Configured for payloads up to ${serverMaxPayloadMB}MB (business logic limit: ${maxPayloadMB}MB)`
        );
      });

      httpsServer.on("error", (error) => {
        console.error("HTTPS Server error:", error);
      });
    } catch (error) {
      console.error("❌ Failed to start HTTPS server:", error.message);
      console.log("⚠️  Falling back to HTTP server...");
    }
  } else {
    console.log(`🌐 HTTP Server running on port ${PORT}`);
    console.log(`🔗 Server URL: http://localhost:${PORT}`);
    console.log(`📱 QR Code available at: http://localhost:${PORT}`);
    console.log(
      `📊 Configured for payloads up to ${serverMaxPayloadMB}MB (business logic limit: ${maxPayloadMB}MB)`
    );
  }
};

main();
