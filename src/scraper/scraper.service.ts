import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const KEYWORDS = [
    'Ayurvedic postnatal care', 'Ayurvedic postpartum care', 'Sutika Paricharya', 'Sootika Paricharya',
    'Ayurvedic confinement center', 'Ayurvedic mother and baby care', 'Ayurveda postnatal massage',
    'Ayur Janani', 'Abhyanga Postnatal', 'Vethu Kuli', 'Maternity Centre', 'Maternity Clinic',
    'Maternity Hospital', 'Post delivery care', 'Postnatal care', 'Postpartum care', 'Mother and baby care',
    'Mom and Baby Care', 'Confinement centre', 'Prasavaraksha', 'Prasava Raksha', 'Women and child hospital',
    'Pregnancy care center', 'Perinatal Care', 'Pre and Postnatal Care', 'Wellness center', 'Alternative medicine clinic',
    'Ayurvedic clinic', 'Ayurveda Hospital', 'Ayurcare', "Women's health clinic", 'Home health care service',
    'Health resort', 'ആയുർവേദ പ്രസവരക്ഷ', 'പ്രസവാനന്തര ശുശ്രൂഷ', 'സൂതിക പരിചരണം', 'ആയുർവേദ പ്രസവ രക്ഷ കേന്ദ്രം',
    'പ്രസവരക്ഷ', 'മെറ്റേണിറ്റി സെന്റർ', 'മാതൃ ശിശു സംരക്ഷണ കേന്ദ്രം', 'മെറ്റേണിറ്റി ഹോസ്പിറ്റൽ', 'മാതൃസംരക്ഷണ കേന്ദ്രം',
    'പ്രസവ ശുശ്രൂഷ', 'സ്ത്രീകളുടെയും കുട്ടികളുടെയും ആശുപത്രി'
];

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  public readonly events = new EventEmitter();
  
  private state: 'IDLE' | 'STAGE_1_RUNNING' | 'STAGE_2_RUNNING' | 'PAUSED' | 'STOPPED' = 'IDLE';
  
  private discoveredIds = new Set<string>();
  private completePlaces: any[] = [];
  private processedIds = new Set<string>();
  
  // Progress tracking
  private totalDiscoveryCalls = 0;
  private currentDiscoveryCall = 0;
  private totalDetailsCalls = 0;
  private currentDetailsCall = 0;

  // Paths
  private discoveredIdsFile = path.resolve(process.cwd(), '../discovered_ids.json');
  private outputFileJSON = path.resolve(process.cwd(), '../kerala_ayurvedic_places_complete.json');
  private outputFileCSV = path.resolve(process.cwd(), '../kerala_ayurvedic_places_complete.csv');
  private reactNativeAppFileJSON = path.resolve(process.cwd(), '../Medilink/src/data/ayurvedic_places.json');

  constructor() {
    this.totalDiscoveryCalls = this.generateTargetZones().length * KEYWORDS.length;
  }

  public getStatus() {
    return {
      state: this.state,
      stage1Progress: this.totalDiscoveryCalls > 0 ? (this.currentDiscoveryCall / this.totalDiscoveryCalls) * 100 : 0,
      stage2Progress: this.totalDetailsCalls > 0 ? (this.currentDetailsCall / this.totalDetailsCalls) * 100 : 0,
      discoveredCount: this.discoveredIds.size,
      extractedCount: this.completePlaces.length,
      currentDiscoveryCall: this.currentDiscoveryCall,
      totalDiscoveryCalls: this.totalDiscoveryCalls,
      currentDetailsCall: this.currentDetailsCall,
      totalDetailsCalls: this.totalDetailsCalls,
    };
  }

  private emitLog(message: string) {
    this.logger.log(message);
    this.events.emit('log', { message, timestamp: new Date().toISOString() });
    this.events.emit('status', this.getStatus());
  }

  public start() {
    if (this.state === 'IDLE' || this.state === 'STOPPED') {
      this.state = 'STAGE_1_RUNNING';
      this.runScraper().catch(e => this.emitLog(`Fatal Error: ${e.message}`));
      return { success: true, message: 'Started' };
    }
    return { success: false, message: 'Already running or paused' };
  }

  public pause() {
    if (this.state.includes('RUNNING')) {
      this.state = 'PAUSED';
      this.emitLog('PAUSED command received. Will pause after current API call...');
      return { success: true, message: 'Paused' };
    }
    return { success: false, message: 'Not running' };
  }

  public resume() {
    if (this.state === 'PAUSED') {
      // We rely on the runScraper loop state to know where it was.
      // But since we just returned from the loop when paused, we just call runScraper again!
      this.state = 'STAGE_1_RUNNING'; // Will instantly jump to STAGE 2 if Stage 1 is done
      this.emitLog('RESUMING...');
      this.runScraper().catch(e => this.emitLog(`Fatal Error: ${e.message}`));
      return { success: true, message: 'Resumed' };
    }
    return { success: false, message: 'Not paused' };
  }

  public stop() {
    this.state = 'STOPPED';
    this.emitLog('STOPPED command received.');
    return { success: true, message: 'Stopped' };
  }

  private async sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  private async checkPause(): Promise<boolean> {
    if (this.state === 'PAUSED' || this.state === 'STOPPED') {
      return true;
    }
    return false;
  }

  private generateTargetZones() {
    const zones = [
        { name: 'Perinthalmanna Core', lat: 10.9760, lng: 76.2254, radius: 15000 },
        { name: 'Malappuram Core', lat: 11.0732, lng: 76.0740, radius: 25000 }
    ];
    for (let lat = 8.2; lat <= 12.8; lat += 0.25) {
        for (let lng = 74.8; lng <= 77.5; lng += 0.25) {
            zones.push({ name: `Grid [${lat.toFixed(2)}, ${lng.toFixed(2)}]`, lat, lng, radius: 30000 });
        }
    }
    return zones;
  }

  private async fetchFromGoogle(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
  }

  private async runScraper() {
    const targetZones = this.generateTargetZones();
    
    // --- STAGE 1: DISCOVERY ---
    // If not completed, run it. If discoveredIds is empty, check disk.
    if (this.discoveredIds.size === 0) {
      if (fs.existsSync(this.discoveredIdsFile)) {
          this.emitLog(`Found existing ${this.discoveredIdsFile}. Loading IDs and SKIPPING Stage 1...`);
          const savedIds = JSON.parse(fs.readFileSync(this.discoveredIdsFile, 'utf8'));
          savedIds.forEach(id => this.discoveredIds.add(id));
          this.currentDiscoveryCall = this.totalDiscoveryCalls;
      }
    }

    if (this.discoveredIds.size === 0 || this.currentDiscoveryCall < this.totalDiscoveryCalls) {
      this.state = 'STAGE_1_RUNNING';
      const tasks: { zone: any, keyword: string }[] = [];
      for (const zone of targetZones) {
          for (const keyword of KEYWORDS) {
              tasks.push({ zone, keyword });
          }
      }

      const BATCH_SIZE = 25;
      for (let i = this.currentDiscoveryCall; i < tasks.length; i += BATCH_SIZE) {
          if (await this.checkPause()) return;

          const batch = tasks.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(async (task) => {
              await this.discoverPlaces(task.zone, task.keyword);
              this.currentDiscoveryCall++;
          }));
          
          this.emitLog(`Discovery Progress: [${this.currentDiscoveryCall}/${this.totalDiscoveryCalls}] Batching 25 zones concurrently | Total Unique IDs: ${this.discoveredIds.size}`);
          
          if (i % 250 === 0) {
              fs.writeFileSync(this.discoveredIdsFile, JSON.stringify(Array.from(this.discoveredIds)));
          }
      }
      fs.writeFileSync(this.discoveredIdsFile, JSON.stringify(Array.from(this.discoveredIds)));
      this.emitLog(`\nSTAGE 1 COMPLETE! Total ${this.discoveredIds.size} unique locations.`);
    }

    if (this.discoveredIds.size === 0) {
        this.emitLog("No places found. Exiting.");
        this.state = 'IDLE';
        return;
    }

    // --- STAGE 2: DEEP EXTRACTION ---
    this.state = 'STAGE_2_RUNNING';
    const idsArray = Array.from(this.discoveredIds);
    this.totalDetailsCalls = idsArray.length;

    if (fs.existsSync(this.outputFileJSON) && this.completePlaces.length === 0) {
        try {
            const existingData = JSON.parse(fs.readFileSync(this.outputFileJSON, 'utf8'));
            if (Array.isArray(existingData)) {
                existingData.forEach(p => {
                    if (p.place_id) {
                        this.completePlaces.push(p);
                        this.processedIds.add(p.place_id);
                    }
                });
                this.emitLog(`Resuming from ${this.completePlaces.length} previously extracted places...`);
            }
        } catch (e) {}
    }
    
    this.currentDetailsCall = this.completePlaces.length;

    const pendingIds = idsArray.filter(id => !this.processedIds.has(id));
    const BATCH_SIZE = 25;
    let writeCounter = 0;

    for (let i = 0; i < pendingIds.length; i += BATCH_SIZE) {
        if (await this.checkPause()) return;

        const batch = pendingIds.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (placeId) => {
            const details = await this.fetchPlaceDetails(placeId);
            if (details) {
                this.completePlaces.push(details);
                this.processedIds.add(placeId);
            }
        }));

        this.currentDetailsCall += batch.length;
        writeCounter += batch.length;
        
        this.emitLog(`Extraction: [${this.currentDetailsCall}/${this.totalDetailsCalls}] Fetching details in batches of ${BATCH_SIZE}...`);

        if (writeCounter >= 250) {
            writeCounter = 0;
            this.saveData();
        }
    }

    this.saveData();
    this.emitLog(`SCRAPING 100% COMPLETE! Extracted ${this.completePlaces.length} places.`);
    this.state = 'IDLE';
  }

  private async discoverPlaces(zone: any, keyword: string) {
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${zone.lat},${zone.lng}&radius=${zone.radius}&keyword=${encodeURIComponent(keyword)}&key=${API_KEY}`;
    let hasNextPage = true;
    while (hasNextPage) {
        try {
            const data = await this.fetchFromGoogle(url);
            if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
                if (data.results) {
                    for (const place of data.results) {
                        this.discoveredIds.add(place.place_id);
                    }
                }
                if (data.next_page_token) {
                    await this.sleep(2500);
                    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${data.next_page_token}&key=${API_KEY}`;
                } else {
                    hasNextPage = false;
                }
            } else {
                this.emitLog(`Discovery API Error: ${data.status} - ${data.error_message || ''}`);
                hasNextPage = false;
            }
        } catch (e) {
            hasNextPage = false;
        }
    }
  }

  private async fetchPlaceDetails(placeId: string) {
    const fields = 'name,formatted_address,address_components,formatted_phone_number,international_phone_number,website,opening_hours,rating,user_ratings_total,url,business_status,geometry,types';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${API_KEY}`;
    try {
        const data = await this.fetchFromGoogle(url);
        if (data.status === 'OK' && data.result) {
            const r = data.result;
            let city = '', district = '', state = '';
            if (r.address_components) {
                for (const comp of r.address_components) {
                    if (comp.types.includes('locality')) city = comp.long_name;
                    if (comp.types.includes('administrative_area_level_2')) district = comp.long_name;
                    if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
                }
            }
            return {
                place_id: placeId,
                name: r.name,
                city, district, state,
                address: r.formatted_address,
                phone: r.formatted_phone_number || r.international_phone_number || '',
                website: r.website || '',
                google_maps_url: r.url || '',
                rating: r.rating || 0,
                user_ratings_total: r.user_ratings_total || 0,
                business_status: r.business_status || '',
                types: r.types?.join(', ') || '',
                lat: r.geometry?.location?.lat,
                lng: r.geometry?.location?.lng,
                opening_hours: r.opening_hours?.weekday_text?.join(' | ') || ''
            };
        }
    } catch (e) {
        this.emitLog(`Details API Error for ${placeId}: ${e.message}`);
    }
    return null;
  }

  private saveData() {
    const dataStr = JSON.stringify(this.completePlaces, null, 2);
    fs.writeFileSync(this.outputFileJSON, dataStr);
    
    // Save CSV
    if (this.completePlaces.length > 0) {
      const headers = ['Name', 'City', 'District', 'State', 'Full Address', 'Phone', 'Website', 'Google Maps URL', 'Rating', 'Reviews', 'Status', 'Types', 'Lat', 'Lng', 'Opening Hours', 'Place ID'];
      const rows = this.completePlaces.map(p => {
          return [
              `"${(p.name || '').replace(/"/g, '""')}"`,
              `"${(p.city || '').replace(/"/g, '""')}"`,
              `"${(p.district || '').replace(/"/g, '""')}"`,
              `"${(p.state || '').replace(/"/g, '""')}"`,
              `"${(p.address || '').replace(/"/g, '""')}"`,
              `"${(p.phone || '').replace(/"/g, '""')}"`,
              `"${(p.website || '').replace(/"/g, '""')}"`,
              `"${(p.google_maps_url || '').replace(/"/g, '""')}"`,
              p.rating,
              p.user_ratings_total,
              p.business_status,
              `"${(p.types || '').replace(/"/g, '""')}"`,
              p.lat,
              p.lng,
              `"${(p.opening_hours || '').replace(/"/g, '""')}"`,
              p.place_id
          ].join(',');
      });
      fs.writeFileSync(this.outputFileCSV, [headers.join(','), ...rows].join('\n'));
    }

    try {
        if (fs.existsSync(path.dirname(this.reactNativeAppFileJSON))) {
            fs.writeFileSync(this.reactNativeAppFileJSON, dataStr);
        }
    } catch (e) {}
  }
}
