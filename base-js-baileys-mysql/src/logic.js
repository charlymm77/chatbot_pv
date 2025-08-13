import axios from "axios";

async function dailyLimitMinus(subject, textPart, htmlPart,token) {
  try {
    const response = await axios.post(
      "http://127.0.0.1:3333/sendEmailFCB",
      {
      
      },
      {
        headers: {
          Authorization: `Bearer ${token || "your-token-here"}`,
        },
      }
    );

    console.log("Email enviado exitosamente:", response.data);
    ///alert("Email enviado correctamente");
  } catch (error) {
    console.error("Error al enviar email:", error);
    //alert("Error al enviar el email");
  }
}

export { dailyLimitMinus };
 