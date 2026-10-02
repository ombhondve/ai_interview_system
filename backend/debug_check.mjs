// Simple debug script to check project PDF state
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function checkProjectState() {
    await mongoose.connect(process.env.STORAGE_MONGODB_URI);
    
    const Candidate = (await import('./src/modules/candidate/candidate.model.js')).default;
    const Project = (await import('./src/modules/projects/project.model.js')).default;
    
    console.log('=== CHECKING CANDIDATES WITH PROJECTS ===');
    
    const candidates = await Candidate.find({ assignedProjectId: { $ne: null } }).lean();
    console.log(`Found ${candidates.length} candidates with projects`);
    
    for (const candidate of candidates) {
        console.log('\n--- Candidate ---');
        console.log(`ID: ${candidate._id}`);
        console.log(`Name: ${candidate.name || 'N/A'}`);
        console.log(`Project ID: ${candidate.assignedProjectId}`);
        
        const project = await Project.findById(candidate.assignedProjectId).lean();
        if (project) {
            console.log(`Project Title: ${project.title}`);
            console.log(`Has PDF URL: ${!!project.pdfUrl}`);
            console.log(`Has Detailed PDF URL: ${!!project.detailedPdfUrl}`);
            
            if (project.pdfUrl) {
                console.log(`PDF URL (first 50 chars): ${project.pdfUrl.substring(0, 50)}...`);
            }
            if (project.detailedPdfUrl) {
                console.log(`Detailed PDF URL (first 50 chars): ${project.detailedPdfUrl.substring(0, 50)}...`);
            }
        }
    }
    
    console.log('\n=== CHECKING ALL PROJECTS ===');
    const projects = await Project.find({}).lean();
    console.log(`Total projects: ${projects.length}`);
    
    const projectsWithPdf = projects.filter(p => p.pdfUrl && p.pdfUrl.trim() !== '');
    console.log(`Projects with PDF URLs: ${projectsWithPdf.length}`);
    
    if (projects.length > 0 && projectsWithPdf.length === 0) {
        console.log('\n⚠️  NO PROJECTS HAVE PDF URLs! Here are the first 3 projects:');
        projects.slice(0, 3).forEach(p => {
            console.log(`- ${p.title}: pdfUrl='${p.pdfUrl}', detailedPdfUrl='${p.detailedPdfUrl}'`);
        });
    }
    
    await mongoose.disconnect();
}

checkProjectState().catch(console.error);