import axios from "axios";

async function sendEmail(subject, textPart, htmlPart) {
  try {
    const response = await axios.post("https://aut-api.cloud:82/sendEmailFCB", {
      subject: subject,
      textPart: textPart,
      htmlPart: htmlPart,
    });

    console.log("Email enviado exitosamente:", response.data);
    ///alert("Email enviado correctamente");
  } catch (error) {
    console.error("Error al enviar email:", error);
    //alert("Error al enviar el email");
  }
}

export { sendEmail };
