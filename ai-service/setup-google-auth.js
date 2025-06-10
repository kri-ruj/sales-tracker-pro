const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');
const GoogleAuthService = require('./services/google-auth.service');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setup() {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                 Google Services Setup Wizard                   ║
╠═══════════════════════════════════════════════════════════════╣
║  This wizard will help you set up Google authentication for:   ║
║  • Gmail (sending, reading emails)                            ║
║  • Google Calendar (creating, managing events)                ║
║  • Google Drive (optional)                                    ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    console.log('\nBefore starting, you need:');
    console.log('1. A Google Cloud Project (create at https://console.cloud.google.com)');
    console.log('2. OAuth2 credentials (create in APIs & Services > Credentials)');
    console.log('3. The credentials JSON file downloaded from Google Cloud Console\n');

    const hasCredentials = await question('Do you have the credentials JSON file? (y/n): ');
    
    if (hasCredentials.toLowerCase() !== 'y') {
        console.log('\n📋 Quick Setup Guide:');
        console.log('1. Go to https://console.cloud.google.com');
        console.log('2. Create a new project or select existing one');
        console.log('3. Enable APIs:');
        console.log('   - Gmail API');
        console.log('   - Google Calendar API');
        console.log('4. Go to "APIs & Services" > "Credentials"');
        console.log('5. Click "Create Credentials" > "OAuth client ID"');
        console.log('6. Choose "Desktop app" as application type');
        console.log('7. Download the JSON file');
        console.log('\nRun this setup again when you have the file.\n');
        rl.close();
        return;
    }

    const credentialsPath = await question('\nEnter the path to your credentials JSON file: ');
    
    try {
        // Read and validate credentials
        const credentialsContent = await fs.readFile(credentialsPath.trim(), 'utf8');
        const credentials = JSON.parse(credentialsContent);
        
        if (!credentials.installed && !credentials.web) {
            throw new Error('Invalid credentials file format');
        }

        // Create credentials directory
        const targetDir = path.join(__dirname, 'credentials');
        await fs.mkdir(targetDir, { recursive: true });
        
        // Copy credentials file
        const targetPath = path.join(targetDir, 'google-credentials.json');
        await fs.writeFile(targetPath, credentialsContent);
        
        console.log('\n✅ Credentials file saved successfully!');
        
        // Update .env file
        const envPath = path.join(__dirname, '.env');
        let envContent = '';
        
        try {
            envContent = await fs.readFile(envPath, 'utf8');
        } catch (e) {
            // .env doesn't exist
        }
        
        if (!envContent.includes('GOOGLE_CREDENTIALS_PATH')) {
            envContent += '\n# Google OAuth2 Credentials\n';
            envContent += `GOOGLE_CREDENTIALS_PATH=./credentials/google-credentials.json\n`;
            await fs.writeFile(envPath, envContent);
            console.log('✅ Updated .env file');
        }

        console.log('\n🔐 Now let\'s authenticate with Google...\n');
        
        const authService = new GoogleAuthService();
        await authService.initialize();
        
        console.log('\n🎉 Setup complete! You can now use real Google services.');
        console.log('\nAvailable features:');
        console.log('• Send and read emails via Gmail');
        console.log('• Create and manage calendar events');
        console.log('• Check availability and schedule meetings\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.log('\nPlease check your credentials file and try again.\n');
    }

    rl.close();
}

// Add to .gitignore
async function updateGitignore() {
    try {
        const gitignorePath = path.join(__dirname, '.gitignore');
        let content = '';
        
        try {
            content = await fs.readFile(gitignorePath, 'utf8');
        } catch (e) {
            // .gitignore doesn't exist
        }
        
        const toAdd = [
            'credentials/',
            'tokens/',
            'google-credentials.json',
            'google-token.json'
        ];
        
        let updated = false;
        for (const item of toAdd) {
            if (!content.includes(item)) {
                content += `\n${item}`;
                updated = true;
            }
        }
        
        if (updated) {
            await fs.writeFile(gitignorePath, content.trim() + '\n');
            console.log('✅ Updated .gitignore to protect credentials');
        }
    } catch (error) {
        console.error('Warning: Could not update .gitignore:', error.message);
    }
}

// Run setup
setup().then(() => updateGitignore()).catch(console.error);