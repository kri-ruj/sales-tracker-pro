/**
 * Plugin Validator
 * Validates plugins for security and compatibility
 */

const semver = require('semver');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class PluginValidator {
    constructor(config = {}) {
        this.config = {
            maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
            allowedExtensions: config.allowedExtensions || ['.js', '.ts', '.json'],
            forbiddenPatterns: config.forbiddenPatterns || [
                /eval\s*\(/,
                /Function\s*\(/,
                /require\s*\(\s*['"]\s*child_process/,
                /require\s*\(\s*['"]\s*fs/,
                /process\.exit/,
                /process\.kill/,
                /__dirname/,
                /__filename/
            ],
            requiredMetadataFields: [
                'name', 'version', 'description', 'author'
            ],
            minAgentVersion: config.minAgentVersion || '1.0.0',
            maxAgentVersion: config.maxAgentVersion || '2.0.0'
        };
    }
    
    /**
     * Validate a plugin
     */
    async validatePlugin(pluginInfo) {
        const errors = [];
        
        try {
            // Validate metadata
            const metadataErrors = await this.validateMetadata(pluginInfo.metadata);
            errors.push(...metadataErrors);
            
            // Validate version compatibility
            const versionErrors = this.validateVersion(pluginInfo.metadata);
            errors.push(...versionErrors);
            
            // Validate permissions
            const permissionErrors = this.validatePermissions(pluginInfo.metadata);
            errors.push(...permissionErrors);
            
            // Validate code security
            const securityErrors = await this.validateSecurity(pluginInfo.path, pluginInfo.singleFile);
            errors.push(...securityErrors);
            
            // Validate dependencies
            if (!pluginInfo.singleFile) {
                const depErrors = await this.validateDependencies(pluginInfo.path);
                errors.push(...depErrors);
            }
            
            // Validate file structure
            const structureErrors = await this.validateFileStructure(pluginInfo.path, pluginInfo.singleFile);
            errors.push(...structureErrors);
            
        } catch (error) {
            errors.push(`Validation error: ${error.message}`);
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings: this.getWarnings(pluginInfo)
        };
    }
    
    /**
     * Validate metadata
     */
    async validateMetadata(metadata) {
        const errors = [];
        
        if (!metadata) {
            return ['Missing plugin metadata'];
        }
        
        // Check required fields
        for (const field of this.config.requiredMetadataFields) {
            if (!metadata[field]) {
                errors.push(`Missing required metadata field: ${field}`);
            }
        }
        
        // Validate name format
        if (metadata.name && !this.isValidPluginName(metadata.name)) {
            errors.push('Invalid plugin name. Must be lowercase alphanumeric with hyphens');
        }
        
        // Validate version format
        if (metadata.version && !semver.valid(metadata.version)) {
            errors.push('Invalid version format. Must follow semantic versioning');
        }
        
        // Validate email if provided
        if (metadata.email && !this.isValidEmail(metadata.email)) {
            errors.push('Invalid email format');
        }
        
        // Validate URLs if provided
        if (metadata.homepage && !this.isValidUrl(metadata.homepage)) {
            errors.push('Invalid homepage URL');
        }
        
        if (metadata.repository && !this.isValidUrl(metadata.repository)) {
            errors.push('Invalid repository URL');
        }
        
        return errors;
    }
    
    /**
     * Validate version compatibility
     */
    validateVersion(metadata) {
        const errors = [];
        
        if (metadata.minAgentVersion) {
            if (!semver.valid(metadata.minAgentVersion)) {
                errors.push('Invalid minAgentVersion format');
            } else if (semver.gt(metadata.minAgentVersion, this.config.maxAgentVersion)) {
                errors.push(`Plugin requires agent version ${metadata.minAgentVersion} which is higher than current maximum ${this.config.maxAgentVersion}`);
            }
        }
        
        if (metadata.maxAgentVersion) {
            if (!semver.valid(metadata.maxAgentVersion)) {
                errors.push('Invalid maxAgentVersion format');
            } else if (semver.lt(metadata.maxAgentVersion, this.config.minAgentVersion)) {
                errors.push(`Plugin supports up to agent version ${metadata.maxAgentVersion} which is lower than current minimum ${this.config.minAgentVersion}`);
            }
        }
        
        return errors;
    }
    
    /**
     * Validate permissions
     */
    validatePermissions(metadata) {
        const errors = [];
        
        if (metadata.permissions && Array.isArray(metadata.permissions)) {
            const validPermissions = new Set(Object.values(require('../interfaces/plugin.interface').PluginPermissions));
            
            for (const permission of metadata.permissions) {
                if (!validPermissions.has(permission)) {
                    errors.push(`Invalid permission requested: ${permission}`);
                }
            }
            
            // Check for dangerous permission combinations
            const perms = new Set(metadata.permissions);
            if (perms.has('fs:write') && perms.has('network:http')) {
                errors.push('Dangerous permission combination: filesystem write + network access');
            }
        }
        
        return errors;
    }
    
    /**
     * Validate code security
     */
    async validateSecurity(pluginPath, singleFile) {
        const errors = [];
        
        try {
            if (singleFile) {
                // Validate single file
                await this.validateFile(pluginPath, errors);
            } else {
                // Validate all JS files in directory
                await this.validateDirectory(pluginPath, errors);
            }
        } catch (error) {
            errors.push(`Security validation error: ${error.message}`);
        }
        
        return errors;
    }
    
    /**
     * Validate a single file
     */
    async validateFile(filePath, errors) {
        // Check file size
        const stats = await fs.stat(filePath);
        if (stats.size > this.config.maxFileSize) {
            errors.push(`File too large: ${filePath} (${stats.size} bytes)`);
            return;
        }
        
        // Check extension
        const ext = path.extname(filePath);
        if (!this.config.allowedExtensions.includes(ext)) {
            errors.push(`Forbidden file extension: ${ext}`);
            return;
        }
        
        // For JS files, check for forbidden patterns
        if (ext === '.js' || ext === '.ts') {
            const content = await fs.readFile(filePath, 'utf8');
            
            for (const pattern of this.config.forbiddenPatterns) {
                if (pattern.test(content)) {
                    errors.push(`Forbidden pattern found in ${filePath}: ${pattern}`);
                }
            }
            
            // Check for suspicious code patterns
            this.checkSuspiciousPatterns(content, filePath, errors);
        }
    }
    
    /**
     * Validate all files in a directory
     */
    async validateDirectory(dirPath, errors, baseDir = dirPath) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                // Skip node_modules and hidden directories
                if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
                    continue;
                }
                
                await this.validateDirectory(fullPath, errors, baseDir);
            } else if (entry.isFile()) {
                await this.validateFile(fullPath, errors);
            }
        }
    }
    
    /**
     * Check for suspicious code patterns
     */
    checkSuspiciousPatterns(content, filePath, errors) {
        const suspiciousPatterns = [
            {
                pattern: /Buffer\s*\.\s*from\s*\([^)]*,\s*['"]hex['"]\)/,
                message: 'Suspicious hex buffer usage'
            },
            {
                pattern: /atob|btoa/,
                message: 'Base64 encoding/decoding detected'
            },
            {
                pattern: /\.env/,
                message: 'Environment file access detected'
            },
            {
                pattern: /process\s*\.\s*env/,
                message: 'Environment variable access detected'
            },
            {
                pattern: /require\s*\.\s*resolve/,
                message: 'Dynamic module resolution detected'
            },
            {
                pattern: /global\s*\[/,
                message: 'Global object manipulation detected'
            }
        ];
        
        for (const { pattern, message } of suspiciousPatterns) {
            if (pattern.test(content)) {
                errors.push(`${message} in ${filePath}`);
            }
        }
    }
    
    /**
     * Validate dependencies
     */
    async validateDependencies(pluginPath) {
        const errors = [];
        
        try {
            const packageJsonPath = path.join(pluginPath, 'package.json');
            const content = await fs.readFile(packageJsonPath, 'utf8');
            const pkg = JSON.parse(content);
            
            // Check for suspicious dependencies
            const suspiciousDeps = [
                'child_process', 'cluster', 'dgram', 'net', 'tls',
                'vm', 'repl', 'inspector', 'v8', 'worker_threads'
            ];
            
            const allDeps = {
                ...pkg.dependencies,
                ...pkg.devDependencies,
                ...pkg.peerDependencies
            };
            
            for (const [dep, version] of Object.entries(allDeps || {})) {
                if (suspiciousDeps.includes(dep)) {
                    errors.push(`Suspicious dependency: ${dep}`);
                }
                
                // Check for git dependencies
                if (version.includes('git') || version.includes('://')) {
                    errors.push(`Git/URL dependency not allowed: ${dep}`);
                }
                
                // Check for file dependencies
                if (version.startsWith('file:')) {
                    errors.push(`File dependency not allowed: ${dep}`);
                }
            }
            
        } catch (error) {
            // Package.json not found or invalid
            if (error.code !== 'ENOENT') {
                errors.push(`Failed to validate dependencies: ${error.message}`);
            }
        }
        
        return errors;
    }
    
    /**
     * Validate file structure
     */
    async validateFileStructure(pluginPath, singleFile) {
        const errors = [];
        
        if (singleFile) {
            // Single file plugins don't need structure validation
            return errors;
        }
        
        try {
            // Check for required files
            const requiredFiles = ['index.js', 'plugin.json'];
            const hasRequiredFile = await Promise.any(
                requiredFiles.map(file => 
                    fs.access(path.join(pluginPath, file)).then(() => true)
                )
            ).catch(() => false);
            
            if (!hasRequiredFile) {
                errors.push('Missing entry point: index.js or plugin.json required');
            }
            
            // Check directory structure
            const entries = await fs.readdir(pluginPath, { withFileTypes: true });
            
            // Check for suspicious directories
            const suspiciousDirs = ['.git', '.svn', 'node_modules'];
            for (const entry of entries) {
                if (entry.isDirectory() && suspiciousDirs.includes(entry.name)) {
                    errors.push(`Suspicious directory found: ${entry.name}`);
                }
            }
            
        } catch (error) {
            errors.push(`File structure validation error: ${error.message}`);
        }
        
        return errors;
    }
    
    /**
     * Get warnings for plugin
     */
    getWarnings(pluginInfo) {
        const warnings = [];
        
        // Check for missing optional metadata
        const optionalFields = ['license', 'homepage', 'repository'];
        for (const field of optionalFields) {
            if (!pluginInfo.metadata[field]) {
                warnings.push(`Missing optional metadata: ${field}`);
            }
        }
        
        // Check for broad permissions
        if (pluginInfo.metadata.permissions?.includes('database:write')) {
            warnings.push('Plugin requests database write access');
        }
        
        if (pluginInfo.metadata.permissions?.includes('network:http')) {
            warnings.push('Plugin requests network access');
        }
        
        return warnings;
    }
    
    /**
     * Helper methods
     */
    
    isValidPluginName(name) {
        return /^[a-z0-9-]+$/.test(name);
    }
    
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Calculate plugin hash for integrity checking
     */
    async calculatePluginHash(pluginPath, singleFile) {
        const hash = crypto.createHash('sha256');
        
        if (singleFile) {
            const content = await fs.readFile(pluginPath);
            hash.update(content);
        } else {
            // Hash all JS files in the plugin
            await this.hashDirectory(pluginPath, hash);
        }
        
        return hash.digest('hex');
    }
    
    async hashDirectory(dirPath, hash) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
                    await this.hashDirectory(fullPath, hash);
                }
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                const content = await fs.readFile(fullPath);
                hash.update(content);
            }
        }
    }
}

module.exports = PluginValidator;