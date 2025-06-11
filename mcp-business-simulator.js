#!/usr/bin/env node

/**
 * MCP Business Simulator - Real business day simulation
 */

import { promises as fs } from 'fs';
import readline from 'readline';

class MCPBusinessSimulator {
  constructor() {
    this.currentTime = new Date('2025-06-11T09:00:00');
    this.salesTeam = [
      { name: 'Sarah Chen', role: 'Senior Sales', status: 'active', points: 0 },
      { name: 'Tom Lee', role: 'Account Manager', status: 'active', points: 0 },
      { name: 'Emma Davis', role: 'Sales Rep', status: 'active', points: 0 },
      { name: 'Alex Johnson', role: 'SDR', status: 'active', points: 0 }
    ];
    this.events = [];
    this.metrics = {
      activities: 0,
      meetings: 0,
      deals: 0,
      revenue: 0
    };
  }

  formatTime() {
    return this.currentTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async simulateHour() {
    console.log(`\n⏰ ${this.formatTime()} - ${this.getDayPart()}`);
    console.log('─'.repeat(40));
    
    // Generate random events for this hour
    const eventCount = Math.floor(Math.random() * 4) + 1;
    
    for (let i = 0; i < eventCount; i++) {
      await this.generateBusinessEvent();
      await this.delay(800);
    }
    
    // Advance time by 1 hour
    this.currentTime.setHours(this.currentTime.getHours() + 1);
  }

  getDayPart() {
    const hour = this.currentTime.getHours();
    if (hour < 12) return 'Morning';
    if (hour < 14) return 'Lunch Hours';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  }

  async generateBusinessEvent() {
    const eventTypes = [
      { type: 'cold-call', points: 25, icon: '📞' },
      { type: 'email', points: 15, icon: '📧' },
      { type: 'meeting', points: 100, icon: '🤝' },
      { type: 'demo', points: 150, icon: '💻' },
      { type: 'proposal', points: 75, icon: '📋' },
      { type: 'deal-closed', points: 500, icon: '🎉' }
    ];
    
    const member = this.salesTeam[Math.floor(Math.random() * this.salesTeam.length)];
    const event = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    // Update metrics
    member.points += event.points;
    this.metrics.activities++;
    
    if (event.type === 'meeting') this.metrics.meetings++;
    if (event.type === 'deal-closed') {
      this.metrics.deals++;
      this.metrics.revenue += Math.floor(Math.random() * 50000) + 10000;
    }
    
    // Display event
    console.log(`${event.icon} ${member.name} - ${event.type} (+${event.points} pts)`);
    
    // Simulate MCP integrations
    if (event.points >= 100) {
      await this.triggerMCPIntegration(member, event);
    }
  }

  async triggerMCPIntegration(member, event) {
    const integrations = [
      '🔄 Synced to Firestore',
      '💬 Team notified via Slack',
      '💚 LINE message sent',
      '🧠 Added to AI analysis queue',
      '📊 Dashboard updated'
    ];
    
    // Show 1-2 random integrations
    const count = Math.floor(Math.random() * 2) + 1;
    for (let i = 0; i < count; i++) {
      const integration = integrations[Math.floor(Math.random() * integrations.length)];
      await this.delay(200);
      console.log(`   ↳ ${integration}`);
    }
  }

  async showDashboard() {
    console.log('\n📊 REAL-TIME DASHBOARD');
    console.log('━'.repeat(50));
    
    // Team leaderboard
    console.log('\n🏆 Current Leaderboard:');
    const sorted = [...this.salesTeam].sort((a, b) => b.points - a.points);
    sorted.forEach((member, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      console.log(`${medal} ${member.name}: ${member.points} points`);
    });
    
    // Business metrics
    console.log('\n📈 Today\'s Metrics:');
    console.log(`   Activities: ${this.metrics.activities}`);
    console.log(`   Meetings: ${this.metrics.meetings}`);
    console.log(`   Deals Closed: ${this.metrics.deals}`);
    console.log(`   Revenue: $${this.metrics.revenue.toLocaleString()}`);
    
    // MCP Status
    console.log('\n🔌 MCP Integrations Active:');
    console.log('   ✅ Sales Tracker - Recording all activities');
    console.log('   ✅ Firestore - Real-time sync enabled');
    console.log('   ✅ AI Analysis - Pattern detection running');
    console.log('   ✅ Notifications - Multi-channel active');
  }

  async simulateAIInsight() {
    console.log('\n🤖 AI INSIGHT ALERT');
    console.log('─'.repeat(40));
    
    const insights = [
      {
        title: 'Opportunity Detected',
        message: 'Sarah\'s demo conversion rate is 85% on Tuesdays',
        action: 'Schedule more Tuesday demos'
      },
      {
        title: 'Team Pattern',
        message: 'Activity drops 40% after 3 PM',
        action: 'Implement afternoon energizer activities'
      },
      {
        title: 'Deal Prediction',
        message: '78% chance of closing TechCorp deal this week',
        action: 'Prioritize TechCorp follow-ups'
      }
    ];
    
    const insight = insights[Math.floor(Math.random() * insights.length)];
    
    console.log(`💡 ${insight.title}`);
    console.log(`📊 ${insight.message}`);
    console.log(`🎯 Recommended: ${insight.action}`);
    console.log('\n✅ Insight shared via Slack & LINE');
  }

  async simulateEmergency() {
    console.log('\n🚨 EMERGENCY SCENARIO');
    console.log('─'.repeat(40));
    console.log('⚠️  Major deal at risk - TechCorp considering competitor');
    
    console.log('\n🤖 MCP Emergency Response:');
    
    const steps = [
      '1. AI analyzing deal history...',
      '2. Identifying key stakeholders...',
      '3. Generating rescue strategy...',
      '4. Notifying account team...',
      '5. Scheduling emergency call...'
    ];
    
    for (const step of steps) {
      await this.delay(600);
      console.log(`   ${step}`);
    }
    
    console.log('\n✅ Emergency response deployed!');
    console.log('📱 Sarah Chen notified via LINE');
    console.log('📧 Personalized retention offer sent');
    console.log('📅 Emergency call scheduled for 2 PM');
  }

  async runBusinessDay() {
    console.log('🏢 MCP BUSINESS DAY SIMULATOR');
    console.log('━'.repeat(50));
    console.log('Simulating a full business day with MCP integrations...\n');
    
    // Morning start
    console.log('🌅 Starting business day simulation...');
    await this.delay(1000);
    
    // Simulate morning hours (9 AM - 12 PM)
    for (let i = 0; i < 3; i++) {
      await this.simulateHour();
    }
    
    // Show morning dashboard
    await this.showDashboard();
    
    // AI Insight
    await this.delay(1000);
    await this.simulateAIInsight();
    
    // Simulate afternoon (1 PM - 5 PM)
    this.currentTime.setHours(13); // Skip lunch
    for (let i = 0; i < 4; i++) {
      await this.simulateHour();
    }
    
    // Emergency scenario
    await this.delay(1000);
    await this.simulateEmergency();
    
    // End of day summary
    await this.delay(1500);
    await this.showEndOfDaySummary();
  }

  async showEndOfDaySummary() {
    console.log('\n\n🌙 END OF DAY SUMMARY');
    console.log('━'.repeat(50));
    
    // Final metrics
    console.log('\n📊 Final Metrics:');
    console.log(`   Total Activities: ${this.metrics.activities}`);
    console.log(`   Meetings Held: ${this.metrics.meetings}`);
    console.log(`   Deals Closed: ${this.metrics.deals}`);
    console.log(`   Revenue Generated: $${this.metrics.revenue.toLocaleString()}`);
    
    // Team performance
    console.log('\n🏆 Top Performer:');
    const winner = [...this.salesTeam].sort((a, b) => b.points - a.points)[0];
    console.log(`   ${winner.name} with ${winner.points} points! 🎉`);
    
    // MCP Impact
    console.log('\n💡 MCP Integration Impact:');
    console.log('   • 73% faster activity logging');
    console.log('   • 100% data accuracy');
    console.log('   • 5x better team coordination');
    console.log('   • 2.3x improvement in response time');
    console.log('   • $15K saved through AI predictions');
    
    // Tomorrow's AI recommendations
    console.log('\n🔮 AI Recommendations for Tomorrow:');
    console.log('   1. Focus on TechCorp retention (Critical)');
    console.log('   2. Schedule team training on demos');
    console.log('   3. Implement suggested Tuesday strategy');
    console.log('   4. Review and contact warm leads');
    
    console.log('\n✨ Business day simulation complete!');
    console.log('   Your MCP ecosystem handled ' + (this.metrics.activities * 5) + ' operations today.');
  }

  async run() {
    await this.runBusinessDay();
  }
}

// Quick simulation mode
class QuickMCPDemo {
  async run() {
    console.log('⚡ QUICK MCP CAPABILITY DEMO\n');
    
    const demos = [
      {
        title: '🔄 Real-time Sync Demo',
        action: async () => {
          console.log('Creating activity in Sales Tracker...');
          await this.delay(500);
          console.log('✅ Activity created: "Demo with TechCorp"');
          console.log('🔄 Syncing to Firestore...');
          await this.delay(300);
          console.log('✅ Firestore updated');
          console.log('🔄 Updating team dashboard...');
          await this.delay(300);
          console.log('✅ Dashboard reflects new activity');
          console.log('📱 Sending LINE notification...');
          await this.delay(300);
          console.log('✅ Team notified via LINE\n');
        }
      },
      {
        title: '🤖 AI Prediction Demo',
        action: async () => {
          console.log('Analyzing sales patterns...');
          await this.delay(800);
          console.log('🧠 AI Prediction: 82% chance to close Deal #4521');
          console.log('💡 Recommended actions:');
          console.log('   1. Send ROI calculator today');
          console.log('   2. Schedule follow-up for Thursday 2 PM');
          console.log('   3. Include customer success stories');
          console.log('✅ Actions added to task list\n');
        }
      },
      {
        title: '🚨 Alert System Demo',
        action: async () => {
          console.log('⚠️  Detecting unusual pattern...');
          await this.delay(600);
          console.log('📉 Alert: Conversion rate dropped 25%');
          console.log('🔍 Root cause analysis...');
          await this.delay(500);
          console.log('💡 Found: Competitor launched new pricing');
          console.log('🎯 Countermeasures deployed:');
          console.log('   ✅ Price match approval requested');
          console.log('   ✅ Value proposition updated');
          console.log('   ✅ Team briefed via Slack\n');
        }
      }
    ];
    
    for (const demo of demos) {
      console.log(demo.title);
      console.log('─'.repeat(40));
      await demo.action();
      await this.delay(1000);
    }
    
    console.log('✨ Quick demo complete! MCP servers are ready for action.');
  }
  
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Check command line argument
const args = process.argv.slice(2);
const mode = args[0];

if (mode === '--quick' || mode === '-q') {
  const quickDemo = new QuickMCPDemo();
  quickDemo.run().catch(console.error);
} else {
  const simulator = new MCPBusinessSimulator();
  simulator.run().catch(console.error);
}