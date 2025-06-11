#!/usr/bin/env node

/**
 * Setup GCP Services for Sales Tracker Pro
 * This script configures Firestore and prepares for Secret Manager
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'salesappfkt';

console.log('🚀 GCP Services Setup for Sales Tracker Pro');
console.log('==========================================\n');

// Function to run gcloud commands with proper Python path
function runGcloudCommand(command) {
    try {
        const result = execSync(`CLOUDSDK_PYTHON=/usr/bin/python3 gcloud ${command}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return result.trim();
    } catch (error) {
        console.error(`Failed to run: gcloud ${command}`);
        console.error(error.message);
        return null;
    }
}

// Set project
console.log(`📋 Setting project to: ${PROJECT_ID}`);
runGcloudCommand(`config set project ${PROJECT_ID}`);

// Enable required APIs
console.log('\n🔌 Enabling required APIs...');
const apis = [
    'firestore.googleapis.com',
    'secretmanager.googleapis.com',
    'appengine.googleapis.com'
];

for (const api of apis) {
    console.log(`  Enabling ${api}...`);
    runGcloudCommand(`services enable ${api}`);
}

// Create Firestore database if needed
console.log('\n📊 Setting up Firestore...');
console.log('Note: Firestore database creation must be done in the console if not exists');
console.log('Visit: https://console.cloud.google.com/firestore');

// Create secure app.yaml
console.log('\n🔐 Creating secure app.yaml...');

const secureAppYaml = `runtime: nodejs20
service: sales-tracker-api

# Environment variables (non-sensitive only)
env_variables:
  NODE_ENV: production
  USE_SECRET_MANAGER: "true"
  GOOGLE_CLOUD_PROJECT: ${PROJECT_ID}

# Automatic scaling configuration
automatic_scaling:
  min_instances: 0
  max_instances: 2
  target_cpu_utilization: 0.65
  target_throughput_utilization: 0.65
  min_pending_latency: 30ms
  max_pending_latency: automatic
  max_concurrent_requests: 10

# Resource allocation for small scale
resources:
  cpu: 1
  memory_gb: 0.5
  disk_size_gb: 10

# Network settings
network:
  session_affinity: true

# Health checks
readiness_check:
  path: "/health"
  check_interval_sec: 5
  timeout_sec: 4
  failure_threshold: 2
  success_threshold: 2

liveness_check:
  path: "/health"
  check_interval_sec: 30
  timeout_sec: 4
  failure_threshold: 4
  success_threshold: 2

# Handlers
handlers:
- url: /.*
  script: auto
  secure: always
  redirect_http_response_code: 301
`;

fs.writeFileSync(path.join(__dirname, '../backend/app.yaml.secure'), secureAppYaml);
console.log('✅ Created backend/app.yaml.secure');

// Create deployment script
console.log('\n📝 Creating deployment script...');

const deployScript = `#!/bin/bash
# Deploy Sales Tracker Pro to GCP

echo "🚀 Deploying Sales Tracker Pro to GCP"
echo "===================================="

# Navigate to backend
cd backend

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Deploy to App Engine
echo "☁️  Deploying to App Engine..."
CLOUDSDK_PYTHON=/usr/bin/python3 gcloud app deploy app.yaml.secure \\
  --project=${PROJECT_ID} \\
  --quiet \\
  --version=firestore

echo "✅ Deployment complete!"
echo "Backend URL: https://sales-tracker-api-dot-${PROJECT_ID}.as.r.appspot.com"
`;

fs.writeFileSync(path.join(__dirname, 'deploy-firestore.sh'), deployScript);
execSync(`chmod +x ${path.join(__dirname, 'deploy-firestore.sh')}`);
console.log('✅ Created scripts/deploy-firestore.sh');

// Instructions for manual steps
console.log('\n📋 Manual Steps Required:');
console.log('========================');
console.log('\n1. Create Firestore Database:');
console.log('   - Go to: https://console.cloud.google.com/firestore');
console.log('   - Select "Native mode"');
console.log('   - Choose location: asia-southeast1');
console.log('   - Click "Create Database"');

console.log('\n2. Set up Secret Manager (manually for now):');
console.log('   - Go to: https://console.cloud.google.com/security/secret-manager');
console.log('   - Create these secrets:');
console.log('     • line-channel-access-token');
console.log('     • line-channel-secret');
console.log('     • admin-token');

console.log('\n3. Copy values from backend/app.yaml to Secret Manager');

console.log('\n4. Grant permissions to App Engine service account:');
console.log(`   Service Account: ${PROJECT_ID}@appspot.gserviceaccount.com`);
console.log('   Role: Secret Manager Secret Accessor');

console.log('\n5. Deploy the application:');
console.log('   cd backend && npm run setup:firestore  # Migrate data');
console.log('   ../scripts/deploy-firestore.sh        # Deploy to GCP');

console.log('\n✅ Setup script completed!');
console.log('\nFor local development:');
console.log('1. Set GOOGLE_APPLICATION_CREDENTIALS to your service account key');
console.log('2. Run: cd backend && npm run dev');

// Create a simple test script
const testScript = `
// Test Firestore connection
const admin = require('firebase-admin');
admin.initializeApp({ projectId: '${PROJECT_ID}' });
const db = admin.firestore();

async function test() {
  try {
    const testDoc = await db.collection('test').add({
      message: 'Hello Firestore!',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Firestore connection successful! Doc ID:', testDoc.id);
    process.exit(0);
  } catch (error) {
    console.error('❌ Firestore connection failed:', error);
    process.exit(1);
  }
}

test();
`;

fs.writeFileSync(path.join(__dirname, '../backend/test-firestore.js'), testScript);
console.log('\nCreated test-firestore.js - Run it to test Firestore connection');