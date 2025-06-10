const swaggerJsdoc = require('swagger-jsdoc');
const yaml = require('yamljs');
const path = require('path');

// Load the OpenAPI specification
const openApiSpec = yaml.load(path.join(__dirname, 'openapi.yaml'));

// Swagger configuration
const swaggerOptions = {
    definition: openApiSpec,
    apis: [
        // Include all route files for additional JSDoc comments
        path.join(__dirname, '../routes/*.js'),
        path.join(__dirname, '../react-agent-enhanced.js'),
        path.join(__dirname, '../unified-server.js'),
        path.join(__dirname, '../services/*.js')
    ],
};

// Generate Swagger specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Custom CSS for Swagger UI
const customCss = `
    .swagger-ui .topbar { 
        display: none;
    }
    .swagger-ui .info .title {
        font-size: 2em;
        color: #333;
    }
    .swagger-ui .info {
        margin-bottom: 40px;
    }
    .swagger-ui .scheme-container {
        background: #f7f7f7;
        padding: 20px;
        border-radius: 8px;
    }
    .swagger-ui .btn.authorize {
        background-color: #4CAF50;
        color: white;
    }
    .swagger-ui .btn.authorize:hover {
        background-color: #45a049;
    }
    .swagger-ui .opblock.opblock-post .opblock-summary-method {
        background: #49cc90;
    }
    .swagger-ui .opblock.opblock-get .opblock-summary-method {
        background: #61affe;
    }
    .swagger-ui .opblock.opblock-put .opblock-summary-method {
        background: #fca130;
    }
    .swagger-ui .opblock.opblock-delete .opblock-summary-method {
        background: #f93e3e;
    }
`;

// Swagger UI options
const swaggerUiOptions = {
    customCss,
    customSiteTitle: "Enhanced ReAct Agent API Documentation",
    customfavIcon: "/favicon.ico",
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        validatorUrl: null,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha'
    }
};

module.exports = {
    swaggerSpec,
    swaggerUiOptions
};