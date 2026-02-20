import { jsPDF } from 'jspdf';
import { CandidateProfile } from '../store/jobsSlice';

/**
 * Generates a resume PDF from a CandidateProfile using jsPDF.
 * Returns base64-encoded PDF string (without data-URI prefix), or null on failure.
 */
export async function generateResumePDF(profile: CandidateProfile): Promise<string | null> {
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 48;
    const contentWidth = pageWidth - 2 * margin;
    let y = 56;

    const BLUE = '#1d4479';
    const DARK = '#222222';
    const GRAY = '#555555';

    const newPageIfNeeded = (needed = 30) => {
      if (y + needed > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        y = 48;
      }
    };

    const addHeading = (text: string, size: number, color: string, bold = true) => {
      newPageIfNeeded(size * 2);
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(color);
      doc.text(text, margin, y);
      y += size * 1.5;
    };

    const addBody = (text: string, size = 10, color = DARK) => {
      if (!text) return;
      doc.setFontSize(size);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(color);
      const lines = doc.splitTextToSize(text, contentWidth);
      lines.forEach((line: string) => {
        newPageIfNeeded(size * 1.6);
        doc.text(line, margin, y);
        y += size * 1.6;
      });
    };

    const addRule = () => {
      newPageIfNeeded(16);
      doc.setDrawColor('#cccccc');
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 12;
    };

    const addSpacer = (h = 8) => { y += h; };

    // ── Header ──────────────────────────────────────────────────────────
    addHeading(profile.name || 'Resume', 22, BLUE);

    const contactParts = [profile.email, profile.phone, profile.location].filter(Boolean);
    if (contactParts.length) addBody(contactParts.join('   |   '), 10, GRAY);
    addSpacer(4);

    if (profile.current_role || profile.current_company) {
      const line = [profile.current_role, profile.current_company].filter(Boolean).join(' @ ');
      addBody(line, 11, DARK);
    }
    addSpacer(4);
    addRule();

    // ── Professional Summary ─────────────────────────────────────────────
    if (profile.resume_summary) {
      addHeading('PROFESSIONAL SUMMARY', 11, BLUE);
      addSpacer(2);
      addBody(profile.resume_summary, 10);
      addSpacer(6);
      addRule();
    }

    // ── Skills ───────────────────────────────────────────────────────────
    if (profile.skills?.length) {
      addHeading('SKILLS', 11, BLUE);
      addSpacer(2);
      addBody(profile.skills.join('   ·   '), 10);
      addSpacer(6);
      addRule();
    }

    // ── Work Experience ───────────────────────────────────────────────────
    if (profile.resume_experience) {
      addHeading('WORK EXPERIENCE', 11, BLUE);
      addSpacer(2);
      addBody(profile.resume_experience, 10);
      addSpacer(6);
      addRule();
    }

    // ── Education ────────────────────────────────────────────────────────
    if (profile.resume_education) {
      addHeading('EDUCATION', 11, BLUE);
      addSpacer(2);
      addBody(profile.resume_education, 10);
      addSpacer(6);
      addRule();
    }

    // ── Certifications & Achievements ────────────────────────────────────
    if (profile.resume_achievements) {
      addHeading('CERTIFICATIONS & ACHIEVEMENTS', 11, BLUE);
      addSpacer(2);
      addBody(profile.resume_achievements, 10);
    }

    // Footer on each page
    const totalPages = (doc.internal as any).getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#aaaaaa');
      doc.text(
        `Generated via MatchDB — Page ${i} of ${totalPages}`,
        margin,
        doc.internal.pageSize.getHeight() - 24,
      );
    }

    // Return base64 string only (no data-URI prefix)
    const dataUri = doc.output('datauristring');
    return dataUri.replace(/^data:application\/pdf;base64,/, '');
  } catch (err) {
    console.error('[generateResumePDF] Failed:', err);
    return null;
  }
}
