# Solución de Problemas de Payload "Too Large"

## Problema
El error "Payload Too Large" puede ocurrir incluso con archivos pequeños (como un PDF de 96KB) debido a múltiples factores:

### Causas Principales

1. **Codificación Base64**: Un archivo de 96KB se convierte en aproximadamente 128KB cuando se codifica en base64
2. **Límites del Framework**: BuilderBot puede tener límites internos más restrictivos
3. **Múltiples Capas de Validación**: El servidor puede tener varios puntos donde se valida el tamaño

## Solución Implementada

### 1. Configuración de Variables de Entorno
```bash
# En el archivo .env
MAX_PAYLOAD_SIZE_MB=100
```

### 2. Configuración del Servidor
- Se configura `maxRequestSize` antes de inicializar las rutas
- Se configura `bodyParser.limit` si está disponible
- Se configura `maxBodySize` si está disponible

### 3. Handler Personalizado
- Monitoreo en tiempo real del tamaño del payload
- Mensajes de error detallados con tamaños exactos
- Logging mejorado para debugging

### 4. Endpoints de Prueba
- `/v1/test-payload`: Para probar límites sin enviar mensajes reales
- Logging detallado de tamaños de archivos

## Cómo Usar

### Ejecutar Pruebas
```bash
# Probar límites generales
npm run test-payload

# Probar con PDF real
npm run test-pdf
```

### Monitorear Logs
El servidor ahora muestra información detallada:
```
📊 Request headers: {...}
📏 Content-Length: 131072 bytes
📄 PDF base64 size: 128KB
📄 PDF original size (approx): 96KB
📦 Total request body size: 135KB
```

### Ajustar Límites
Modifica la variable `MAX_PAYLOAD_SIZE_MB` en el archivo `.env`:
```bash
MAX_PAYLOAD_SIZE_MB=200  # Para 200MB
```

## Debugging

### Verificar Configuración Actual
1. Inicia el servidor y revisa los logs de configuración:
```
🔧 Configuring server limits...
✅ Server maxRequestSize set to: 104857600 bytes (100MB)
✅ BodyParser limit set to 100mb
```

2. Visita `http://localhost:4009` para ver la configuración actual en la interfaz web

### Probar Diferentes Tamaños
Usa el endpoint de prueba para verificar qué tamaños funcionan:
```bash
curl -X POST http://localhost:4009/v1/test-payload \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## Notas Importantes

1. **Base64 Aumenta el Tamaño**: Un archivo de 96KB se convierte en ~128KB en base64
2. **JSON Overhead**: El JSON completo puede ser más grande que solo el archivo
3. **Headers HTTP**: También cuentan para el tamaño total de la request
4. **Límites del Sistema**: El sistema operativo también puede tener límites

## Si el Problema Persiste

1. Aumenta `MAX_PAYLOAD_SIZE_MB` en `.env`
2. Verifica los logs del servidor para identificar dónde falla exactamente
3. Usa los scripts de prueba para aislar el problema
4. Considera comprimir los PDFs antes de enviarlos