const SwaggerParser = require('@apidevtools/swagger-parser');
const path = require('path');
const fs = require('fs');

/**
 * Validate OpenAPI documentation
 */
async function validateOpenAPISpec() {
    console.log('🔍 Validating OpenAPI specification...\n');
    
    const specPath = path.join(__dirname, 'openapi.yaml');
    
    try {
        // Check if file exists
        if (!fs.existsSync(specPath)) {
            throw new Error(`OpenAPI spec not found at: ${specPath}`);
        }
        
        // Parse and validate
        const api = await SwaggerParser.validate(specPath);
        
        console.log('✅ OpenAPI specification is valid!\n');
        console.log('📋 API Information:');
        console.log(`   Title: ${api.info.title}`);
        console.log(`   Version: ${api.info.version}`);
        console.log(`   Description: ${api.info.description?.substring(0, 100)}...`);
        
        // Count endpoints
        const paths = Object.keys(api.paths);
        let totalEndpoints = 0;
        const methods = {};
        
        paths.forEach(path => {
            Object.keys(api.paths[path]).forEach(method => {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
                    totalEndpoints++;
                    methods[method] = (methods[method] || 0) + 1;
                }
            });
        });
        
        console.log(`\n📊 API Statistics:`);
        console.log(`   Total Endpoints: ${totalEndpoints}`);
        console.log(`   Total Paths: ${paths.length}`);
        
        console.log(`\n🔧 HTTP Methods:`);
        Object.entries(methods).forEach(([method, count]) => {
            console.log(`   ${method.toUpperCase()}: ${count}`);
        });
        
        // List tags
        if (api.tags && api.tags.length > 0) {
            console.log(`\n🏷️  Tags (${api.tags.length}):`);
            api.tags.forEach(tag => {
                console.log(`   - ${tag.name}: ${tag.description}`);
            });
        }
        
        // Check security schemes
        if (api.components && api.components.securitySchemes) {
            console.log(`\n🔐 Security Schemes:`);
            Object.entries(api.components.securitySchemes).forEach(([name, scheme]) => {
                console.log(`   - ${name}: ${scheme.type} (${scheme.scheme || scheme.in})`);
            });
        }
        
        // List available schemas
        if (api.components && api.components.schemas) {
            const schemas = Object.keys(api.components.schemas);
            console.log(`\n📝 Schemas (${schemas.length}):`);
            console.log(`   ${schemas.slice(0, 10).join(', ')}${schemas.length > 10 ? '...' : ''}`);
        }
        
        // WebSocket documentation
        if (api['x-websocket-events']) {
            console.log(`\n🔌 WebSocket Events Documented: Yes`);
        }
        
        console.log('\n✨ Documentation validation complete!');
        
        // Additional checks
        console.log('\n🔍 Running additional checks...');
        
        // Check for missing descriptions
        let missingDescriptions = 0;
        paths.forEach(path => {
            Object.entries(api.paths[path]).forEach(([method, operation]) => {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
                    if (!operation.description && !operation.summary) {
                        missingDescriptions++;
                        console.log(`   ⚠️  Missing description: ${method.toUpperCase()} ${path}`);
                    }
                }
            });
        });
        
        if (missingDescriptions === 0) {
            console.log('   ✅ All endpoints have descriptions');
        }
        
        // Check for examples
        let endpointsWithExamples = 0;
        paths.forEach(path => {
            Object.entries(api.paths[path]).forEach(([method, operation]) => {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
                    if (operation.requestBody?.content?.['application/json']?.examples ||
                        operation.requestBody?.content?.['application/json']?.example) {
                        endpointsWithExamples++;
                    }
                }
            });
        });
        
        console.log(`   ℹ️  Endpoints with examples: ${endpointsWithExamples}/${totalEndpoints}`);
        
        console.log('\n🎉 All validation checks passed!\n');
        
        return true;
        
    } catch (error) {
        console.error('❌ Validation failed!\n');
        console.error('Error:', error.message);
        
        if (error.details) {
            console.error('\nDetails:');
            error.details.forEach(detail => {
                console.error(`  - ${detail}`);
            });
        }
        
        return false;
    }
}

// Run validation if called directly
if (require.main === module) {
    validateOpenAPISpec()
        .then(valid => {
            process.exit(valid ? 0 : 1);
        })
        .catch(error => {
            console.error('Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = { validateOpenAPISpec };