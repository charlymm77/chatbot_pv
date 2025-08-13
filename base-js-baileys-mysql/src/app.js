import { join } from "path";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "fs";
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
import { MysqlAdapter as Database } from "@builderbot/database-mysql";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { sendEmail } from "./emails.js";

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
  const adapterDB = new Database({
    host: process.env.MYSQL_DB_HOST,
    port: process.env.MYSQL_DB_PORT || 3306,
    user: process.env.MYSQL_DB_USER,
    database: process.env.MYSQL_DB_NAME,
    password: process.env.MYSQL_DB_PASSWORD,
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

  // Event listeners para capturar QR y estado de conexión
  adapterProvider.on('qr', (qr) => {
    console.log('📱 QR Code generated');
    currentQR = qr;
    botConnected = false;
  });

  adapterProvider.on('ready', () => {
    console.log('✅ Bot connected to WhatsApp');
    currentQR = null;
    botConnected = true;
  });

  adapterProvider.on('auth_failure', () => {
    console.log('❌ Authentication failed');
    currentQR = null;
    botConnected = false;
  });

  adapterProvider.on('disconnected', () => {
    console.log('⚠️ Bot disconnected from WhatsApp');
    botConnected = false;
  });

  // También escuchar eventos del proveedor interno
  if (adapterProvider.vendor && adapterProvider.vendor.ev) {
    adapterProvider.vendor.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('📱 QR Code generated from vendor');
        currentQR = qr;
        botConnected = false;
      }
      
      if (connection === 'close') {
        console.log('⚠️ Connection closed');
        botConnected = false;
      } else if (connection === 'open') {
        console.log('✅ Connection opened');
        currentQR = null;
        botConnected = true;
      }
    });
  }

  adapterProvider.server.post(
    "/v1/messages",
    handleCtx(async (bot, req, res) => {
      try {
        const { number, message, pdf, xml, customerName } = req.body;

        // Si el mensaje es null o vacío, usar un mensaje predeterminado
        const finalMessage =
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
          // Si hay un PDF, enviarlo
          if (pdf) {
            // Generar nombre único para el archivo temporal
            const timestamp = Date.now();
            const pdfFileName = `factura_pdf_${timestamp}.pdf`;
            const pdfFilePath = join(process.cwd(), pdfFileName);

            try {
              // Función para validar si es base64 válido
              const isValidBase64 = (str) => {
                try {
                  return Buffer.from(str, "base64").toString("base64") === str;
                } catch (err) {
                  return false;
                }
              };

              // Verificar si el contenido es base64 válido
              if (isValidBase64(pdf)) {
                // Decodificar el base64 y guardar como archivo temporal
                const pdfBuffer = Buffer.from(pdf, "base64");
                writeFileSync(pdfFilePath, pdfBuffer);

                // Enviar el archivo PDF
                await bot.sendMessage(number, "", {
                  media: pdfFilePath,
                });

                // Borrar el archivo temporal después del envío
                if (existsSync(pdfFilePath)) {
                  unlinkSync(pdfFilePath);
                }
              } else {
                // Si no es base64, asumir que es una ruta de archivo
                await bot.sendMessage(number, "", { media: pdf });
              }
            } catch (pdfError) {
              console.error("Error procesando PDF:", pdfError);
              // Limpiar archivo si existe en caso de error
              if (existsSync(pdfFilePath)) {
                unlinkSync(pdfFilePath);
              }
              throw pdfError;
            }
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

          // Si no hay PDF ni XML, enviar solo el mensaje
          if (!pdf && !xml && message) {
            await bot.sendMessage(number, message);
          }

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
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              status: "ok",
              message: `Mensaje enviado exitosamente a ${number}`,
              method: "whatsapp",
            })
          );
        } catch (error) {
          console.error("Error enviando mensaje:", error);
          const errorDetails = `
          Endpoint: /v1/messages
          Timestamp: ${new Date().toISOString()}
          Error: ${error.message}
          Stack: ${error.stack}
          Request Body: ${JSON.stringify(req.body, null, 2)}
        `;
          await sendEmail(
            "Error crítico en CHATBOT - Endpoint /v1/messages",
            errorDetails,
            `
          <h2>Error en el Sistema de CHATBOT</h2>
          <p><strong>Endpoint:</strong> /v1/messages</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <p><strong>Request Body:</strong></p>
          <pre>${JSON.stringify(req.body, null, 2)}</pre>
          <p><strong>Stack Trace:</strong></p>
          <pre>${error.stack}</pre>
        `
          );
          res.writeHead(500, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              status: "error",
              message: `Error enviando mensaje: ${error.message}`,
            })
          );
        }
      } catch (error) {
        const errorDetails = `
          Endpoint: /v1/messages
          Timestamp: ${new Date().toISOString()}
          Error: ${error.message}
          Stack: ${error.stack}
          Request Body: ${JSON.stringify(req.body, null, 2)}
        `;
        await sendEmail(
          "Error crítico en CHATBOT - Endpoint /v1/messages",
          errorDetails,
          `
          <h2>Error en el Sistema de CHATBOT</h2>
          <p><strong>Endpoint:</strong> /v1/messages</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Error:</strong> ${error.message}</p>
          <p><strong>Request Body:</strong></p>
          <pre>${JSON.stringify(req.body, null, 2)}</pre>
          <p><strong>Stack Trace:</strong></p>
          <pre>${error.stack}</pre>
        `
        );
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            status: "error",
            message: `Error enviando mensaje: ${error.message}`,
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

  // Ruta principal para mostrar el QR code en el navegador
  adapterProvider.server.get("/", async (req, res) => {
    try {
      // Intentar obtener el QR de diferentes fuentes
      const qrCode = currentQR || adapterProvider.qr || (adapterProvider.vendor && adapterProvider.vendor.qr);
      const isConnected = botConnected || (adapterProvider.vendor && adapterProvider.vendor.ws && adapterProvider.vendor.ws.readyState === 1);

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
              padding: 15px;
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
            dark: '#000000',
            light: '#FFFFFF'
          }
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
              • POST /v1/messages - Enviar mensajes<br>
              • POST /v1/register - Registrar usuario<br>
              • POST /v1/blacklist - Gestionar lista negra
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
      const qrCode = currentQR || adapterProvider.qr || (adapterProvider.vendor && adapterProvider.vendor.qr);

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
      const isConnected = botConnected || (adapterProvider.vendor && adapterProvider.vendor.ws && adapterProvider.vendor.ws.readyState === 1);
      const qrAvailable = !!(currentQR || adapterProvider.qr || (adapterProvider.vendor && adapterProvider.vendor.qr));

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

  // Start server with HTTPS if SSL is enabled
  console.log(`SSL Configuration:`);
  console.log(`- SSL_ENABLED: ${process.env.SSL_ENABLED}`);
  console.log(`- SSL Enabled: ${SSL_CONFIG.enabled}`);
  console.log(`- Key Path: ${SSL_CONFIG.keyPath}`);
  console.log(`- Cert Path: ${SSL_CONFIG.certPath}`);
  console.log(`- CA Path: ${SSL_CONFIG.caPath}`);

  if (SSL_CONFIG.enabled) {
    try {
      console.log("� Loading SSL certificates...");
      const sslOptions = loadSSLCertificates();
      console.log("✅ SSL certificates loaded successfully");

      // Primero inicializar BuilderBot con HTTP para que genere el QR
      httpServer(+PORT);
      
      // Luego crear el servidor HTTPS que proxy al HTTP
      const httpsServer = https.createServer(sslOptions, adapterProvider.server.handler);

      const httpsPort =  4008; // Puerto 5008 para HTTPS
      httpsServer.listen(httpsPort, () => {
        console.log(`� HTTPS  Server running on port ${httpsPort}`);
        console.log(`� HTTPSd URL: https://localhost:${httpsPort}`);
        console.log(`🌐 HTTP URL: http://localhost:${PORT} (for QR generation)`);
        console.log(`📱 QR Code available at both URLs`);
      });

      httpsServer.on("error", (error) => {
        console.error("HTTPS Server error:", error);
      });
    } catch (error) {
      console.error("❌ Failed to start HTTPS server:", error.message);
      console.log("⚠️  Falling back to HTTP server...");
      httpServer(+PORT);
    }
  } else {
    console.log(`🌐 HTTP Server running on port ${PORT}`);
    console.log(`🔗 Server URL: http://localhost:${PORT}`);
    console.log(`📱 QR Code available at: http://localhost:${PORT}`);
    httpServer(+PORT);
  }
};

main();
