/**
 * TattooNOW Onboarding — Google Apps Script
 *
 * Sheets managed:
 *   "Tasks by Benefit"  — Editable master list of all setup tasks grouped by benefit
 *   "Launchpad"         — Per-client launchpad checklist progress
 *   "Priorities"        — Per-client benefit selections from onboarding
 *
 * Deploy as: Web App → Execute as: Me → Access: Anyone
 */

var SECRET = 'tattoonow_onboarding_2024';

// ── Master task list (used to seed the "Tasks by Benefit" sheet) ─────

var SEED_TASKS = [
  // — Get More Clients —
  { order: 1,  benefit: 'Get More Clients',          id: 'gmc-1', name: 'Launch portfolio website',          desc: 'Publish a search-engine-optimized portfolio site showcasing your work.',            tool: 'Website Builder',  setup: 'Go to Sites > New Website. Choose a portfolio template, upload your best 10-15 photos, add your bio and contact info, then hit Publish.' },
  { order: 2,  benefit: 'Get More Clients',          id: 'gmc-2', name: 'Set up reputation management',      desc: 'Automate Google review requests after every appointment.',                          tool: 'Reputation',       setup: 'Go to Reputation > Settings. Connect your Google Business Profile, customize the review request message, and enable auto-send after appointments.' },
  { order: 3,  benefit: 'Get More Clients',          id: 'gmc-3', name: 'Connect social media accounts',     desc: 'Link Instagram, Facebook, and TikTok for auto-posting.',                            tool: 'Post Scheduler',   setup: 'Go to Marketing > Social Planner > Settings. Click Connect Account for each platform and follow the login prompts to authorize access.' },
  { order: 4,  benefit: 'Get More Clients',          id: 'gmc-4', name: 'Create your first email campaign',  desc: 'Draft a welcome email or flash sale announcement for your list.',                    tool: 'Email Marketing',  setup: 'Go to Marketing > Emails > Create Campaign. Pick a template, add your subject line and body text, select your audience, and schedule or send.' },

  // — Never Miss a Lead —
  { order: 5,  benefit: 'Never Miss a Lead',         id: 'nml-1', name: 'Create lead capture funnel',        desc: 'Build a sales funnel that turns visitors into booked consultations.',                tool: 'Sales Funnels',    setup: 'Go to Sites > Funnels > Create Funnel. Select the Tattoo Consultation template, customize the form fields (name, email, style preference), and publish.' },
  { order: 6,  benefit: 'Never Miss a Lead',         id: 'nml-2', name: 'Set up follow-up sequences',        desc: 'Configure nurture sequences so no lead goes cold.',                                  tool: 'Sales Funnels',    setup: 'Go to Automation > Workflows > Create Workflow. Use the Lead Follow-Up template — set triggers for new contact, add SMS + email steps with wait times.' },
  { order: 7,  benefit: 'Never Miss a Lead',         id: 'nml-3', name: 'Import client list to CRM',         desc: 'Upload existing contacts and tag them so no one falls through the cracks.',          tool: 'CRM',              setup: 'Go to Contacts > Import. Download the CSV template, fill in your client names/emails/phones, upload the file, and map the columns. Tag imported contacts.' },
  { order: 8,  benefit: 'Never Miss a Lead',         id: 'nml-4', name: 'Activate One-Box unified inbox',    desc: 'Connect calls, texts, DMs, and emails into a single view.',                          tool: 'One-Box',          setup: 'Go to Conversations > Settings. Connect your phone number (or get a new one), link your email, and connect Facebook/Instagram DMs under Integrations.' },

  // — Communicate Best-in-Class —
  { order: 9,  benefit: 'Communicate Best-in-Class', id: 'cbc-1', name: 'Configure booking calendar',        desc: 'Set your availability and enable online booking with deposits.',                     tool: 'Calendars',        setup: 'Go to Calendars > Calendar Settings. Set your working hours, appointment duration, and buffer time. Enable deposits under Payments tab and set the amount.' },
  { order: 10, benefit: 'Communicate Best-in-Class', id: 'cbc-2', name: 'Enable automated reminders',        desc: 'Reduce no-shows with text and email reminders before every appointment.',            tool: 'Calendars',        setup: 'Go to Calendars > Notifications. Enable SMS and email reminders, set timing (e.g. 24hr and 1hr before), and customize the reminder message text.' },
  { order: 11, benefit: 'Communicate Best-in-Class', id: 'cbc-3', name: 'Set up two-way texting',            desc: 'Give clients a professional way to reach you with auto-replies when busy.',           tool: 'One-Box',          setup: 'Go to Conversations > Settings > Auto-Reply. Set your business hours, write an after-hours auto-reply message, and enable the missed-call text-back.' },
  { order: 12, benefit: 'Communicate Best-in-Class', id: 'cbc-4', name: 'Automate post-session reviews',     desc: 'Automatically ask for Google reviews after every appointment.',                       tool: 'Reputation',       setup: 'Go to Automation > Workflows > Create. Trigger: Appointment Status Changed to "Completed". Action: Send review request SMS with your Google review link.' },

  // — Get Paid Faster —
  { order: 13, benefit: 'Get Paid Faster',           id: 'gpf-1', name: 'Enable booking with deposits',      desc: 'Require deposits at booking time to reduce no-shows and secure revenue.',             tool: 'Appointments',     setup: 'Go to Calendars > Calendar Settings > Payments. Toggle on "Require deposit", set the amount (e.g. $50), and connect Stripe if not already linked.' },
  { order: 14, benefit: 'Get Paid Faster',           id: 'gpf-2', name: 'Set up Text-to-Pay',                desc: 'Send payment links via SMS so clients can pay instantly.',                            tool: 'Text-to-Pay',      setup: 'Go to Payments > Text-to-Pay. Connect your Stripe account, set a default payment message template, and test by sending yourself a payment link.' },
  { order: 15, benefit: 'Get Paid Faster',           id: 'gpf-3', name: 'Connect payment processing',        desc: 'Link your bank account and set up credit card processing.',                          tool: 'Payments',         setup: 'Go to Payments > Integrations. Click Connect Stripe, follow the setup wizard to enter your bank details and verify your identity. Takes about 5 minutes.' },
  { order: 16, benefit: 'Get Paid Faster',           id: 'gpf-4', name: 'Configure auto-invoicing',          desc: 'Automatically send invoices and receipts after appointments.',                        tool: 'Appointments',     setup: 'Go to Payments > Invoices > Settings. Enable auto-invoice on appointment completion, customize your invoice template with logo and terms, and set payment due date.' },

  // — Save Time —
  { order: 17, benefit: 'Save Time',                 id: 'st-1',  name: 'Schedule first week of posts',      desc: 'Queue up social media posts so you never miss a day.',                                tool: 'Post Scheduler',   setup: 'Go to Marketing > Social Planner. Click New Post, upload a photo, write a caption, select platforms, and pick a date/time. Repeat for 5-7 posts.' },
  { order: 18, benefit: 'Save Time',                 id: 'st-2',  name: 'Set up auto-replies in One-Box',    desc: 'Configure after-hours messages and quick replies for common questions.',              tool: 'One-Box',          setup: 'Go to Conversations > Settings > Canned Responses. Create replies for common questions (pricing, hours, booking). Then set up auto-reply under Auto-Reply tab.' },
  { order: 19, benefit: 'Save Time',                 id: 'st-3',  name: 'Create email automation sequences', desc: 'Build a post-appointment follow-up sequence that runs on autopilot.',                 tool: 'Email Marketing',  setup: 'Go to Automation > Workflows > Create. Trigger: Appointment Completed. Add email steps: thank-you (Day 0), aftercare tips (Day 3), review request (Day 7).' },
  { order: 20, benefit: 'Save Time',                 id: 'st-4',  name: 'Enable appointment reminders',      desc: 'Reduce no-shows with automated text and email reminders.',                            tool: 'Calendars',        setup: 'Go to Calendars > Notifications. Toggle on SMS and email reminders. Set to send 24 hours and 1 hour before each appointment. Customize message text.' },

  // — Grow Your Team —
  { order: 21, benefit: 'Grow Your Team',            id: 'gt-1',  name: 'Set up multi-artist management',    desc: 'Add your team members with individual calendars and permissions.',                    tool: 'Multi-Artist',     setup: 'Go to Settings > My Staff > Add Employee. Enter each artist\'s name and email. Assign their calendar and set permissions (what they can view/edit).' },
  { order: 22, benefit: 'Grow Your Team',            id: 'gt-2',  name: 'Create artist profiles',            desc: 'Build portfolio pages for each artist to attract their ideal clients.',               tool: 'Website Builder',  setup: 'Go to Sites > Website > Add Page. Choose the Artist Profile template. Add artist photo, bio, specialty styles, and gallery images. Link from the main site.' },
  { order: 23, benefit: 'Grow Your Team',            id: 'gt-3',  name: 'Explore recruiting services',       desc: 'Connect with TattooNOW placement network to find new talent.',                        tool: 'Recruiting',       setup: 'Visit the TattooNOW Recruiting portal from your dashboard. Fill out the studio profile, list open positions, and set your preferred styles and experience level.' },
  { order: 24, benefit: 'Grow Your Team',            id: 'gt-4',  name: 'Draft studio business plan',        desc: 'Use the Living Business Plan template to set goals and benchmarks.',                  tool: 'Business Plan',    setup: 'Go to Tools > Business Plan. Open the Living Business Plan template. Complete each section: vision, revenue goals, team structure, and marketing strategy.' },

  // — Level Up My Business —
  { order: 25, benefit: 'Level Up My Business',      id: 'lu-1',  name: 'Join Business Roundtable',          desc: 'RSVP for the weekly session with industry peers and experts.',                        tool: 'Roundtable',       setup: 'Go to Tools > Roundtable. View the upcoming session schedule, click RSVP on the next available date, and add it to your calendar.' },
  { order: 26, benefit: 'Level Up My Business',      id: 'lu-2',  name: 'Schedule 1-on-1 consult',           desc: 'Book your initial consultation with a TattooNOW business expert.',                    tool: 'Consulting',       setup: 'Go to Tools > Consulting. Browse available consultants, pick a time slot that works for you, and book your session. Prepare a list of questions beforehand.' },
  { order: 27, benefit: 'Level Up My Business',      id: 'lu-3',  name: 'Explore RIT courses',               desc: 'Browse professional development courses tailored for tattooers.',                     tool: 'Courses',          setup: 'Go to Tools > Courses. Browse the course library by category (business, marketing, technique). Enroll in a course and start with the first module.' },
  { order: 28, benefit: 'Level Up My Business',      id: 'lu-4',  name: 'Start Living Business Plan',        desc: 'Begin building your roadmap for growth with guided templates.',                       tool: 'Business Plan',    setup: 'Go to Tools > Business Plan. Click Start New Plan, answer the guided prompts about your studio goals, and save your draft. Revisit monthly to update progress.' }
];

// ── Entry point ──────────────────────────────────────────────────────

function doGet(e) {
  var p = e.parameter;

  if (p.secretKey !== SECRET) {
    return _json({ success: false, error: 'Unauthorized' });
  }

  var page   = p.page || 'launchpad';
  var action = p.action;

  // loadTasks: return the editable task list from the "Tasks by Benefit" sheet
  if (action === 'loadTasks') {
    return _loadTasks();
  }

  if (page === 'priorities') {
    return action === 'save' ? _savePriorities(p) : _loadPriorities(p);
  }
  return action === 'save' ? _saveLaunchpad(p) : _loadLaunchpad(p);
}

// ── Load Tasks: read from "Tasks by Benefit" sheet ──────────────────

function _loadTasks() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = _ensureTaskSheet(ss);
  var data = sheet.getDataRange().getValues();

  // Group rows into benefits with their tasks
  var benefitMap = {};  // benefitName → { id, title, tasks[] }
  var benefitOrder = []; // preserve order from sheet

  for (var i = 1; i < data.length; i++) {
    var order      = data[i][0];
    var benefit    = data[i][1]; // e.g. "Get More Clients"
    var taskId     = data[i][2]; // e.g. "gmc-1"
    var taskName   = data[i][3];
    var taskDesc   = data[i][4];
    var toolName   = data[i][5];
    var setupInst  = data[i][6] || ''; // column G: Setup Instructions

    if (!benefit || !taskId) continue;

    // Derive benefit ID from task ID prefix
    var prefix = taskId.replace(/-\d+$/, '');
    var keyMap = {
      'gmc': 'get-more-clients', 'nml': 'never-miss-leads',
      'cbc': 'communicate-best', 'gpf': 'get-paid-faster',
      'st':  'save-time',        'gt':  'grow-team',
      'lu':  'level-up'
    };
    var benefitId = keyMap[prefix] || prefix;

    if (!benefitMap[benefitId]) {
      benefitMap[benefitId] = {
        id: benefitId,
        title: benefit,
        tasks: []
      };
      benefitOrder.push(benefitId);
    }

    benefitMap[benefitId].tasks.push({
      id:   taskId,
      name: taskName,
      desc: taskDesc,
      tool: toolName,
      setup: setupInst
    });
  }

  // Build ordered array
  var benefits = [];
  benefitOrder.forEach(function(bId) {
    benefits.push(benefitMap[bId]);
  });

  return _json({ success: true, benefits: benefits });
}

// ── Ensure "Tasks by Benefit" sheet exists ───────────────────────────

function _ensureTaskSheet(ss) {
  var sheet = ss.getSheetByName('Tasks by Benefit');
  if (sheet) return sheet;

  sheet = ss.insertSheet('Tasks by Benefit');
  var headers = ['Order', 'Benefit', 'Task ID', 'Task Name', 'Description', 'Tool', 'Setup Instructions'];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Populate with all 28 tasks
  var rows = [];
  SEED_TASKS.forEach(function(t) {
    rows.push([t.order, t.benefit, t.id, t.name, t.desc, t.tool, t.setup || '']);
  });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  // Auto-size columns
  for (var c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
  }

  return sheet;
}

// ── Priorities: Save ─────────────────────────────────────────────────

function _savePriorities(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Ensure the editable task reference sheet exists
  _ensureTaskSheet(ss);

  // ---- Priorities tab ------------------------------------------------
  var priSheet = _getOrCreateSheet(ss, 'Priorities', [
    'Location ID', 'Contact Name', 'Business Name', 'Email', 'Phone',
    'Priority #1', 'Priority #2', 'Priority #3', 'Priority #4',
    'Current Screen', 'Completed', 'Submitted At', 'Last Updated'
  ]);

  var benefits = _parseJSON(p.selectedBenefits, []);

  // Read benefit names from the Tasks sheet so edits are respected
  var taskSheet = ss.getSheetByName('Tasks by Benefit');
  var benefitNames = _buildBenefitLookup(taskSheet);

  var priRow = [
    p.locationId,
    p.contactName   || '',
    p.businessName  || '',
    p.contactEmail  || '',
    p.contactPhone  || '',
    benefitNames[benefits[0]] || benefits[0] || '',
    benefitNames[benefits[1]] || benefits[1] || '',
    benefitNames[benefits[2]] || benefits[2] || '',
    benefitNames[benefits[3]] || benefits[3] || '',
    p.currentScreen || '0',
    p.onboardingCompleted === 'true' ? 'Yes' : 'No',
    p.submittedAt   || '',
    new Date().toISOString()
  ];

  _upsertRow(priSheet, p.locationId, priRow);
  return _json({ success: true });
}

// ── Priorities: Load ─────────────────────────────────────────────────

function _loadPriorities(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var priSheet = ss.getSheetByName('Priorities');
  if (!priSheet) return _json({ success: true, data: null });

  var priRow = _findRow(priSheet, p.locationId);
  if (!priRow) return _json({ success: true, data: null });

  // Reverse-lookup: display name → benefit ID from the Tasks sheet
  var taskSheet = ss.getSheetByName('Tasks by Benefit');
  var reverseNames = {};
  if (taskSheet) {
    var data = taskSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var benefitName = data[i][1]; // column B
      var taskId = data[i][2];      // column C
      if (taskId && benefitName) {
        // Extract benefit key from task ID prefix
        var prefix = taskId.replace(/-\d+$/, '');
        var keyMap = {
          'gmc': 'get-more-clients', 'nml': 'never-miss-leads',
          'cbc': 'communicate-best', 'gpf': 'get-paid-faster',
          'st':  'save-time',        'gt':  'grow-team',
          'lu':  'level-up'
        };
        if (keyMap[prefix]) reverseNames[benefitName] = keyMap[prefix];
      }
    }
  }

  var selectedBenefits = [];
  for (var i = 5; i <= 8; i++) {
    var name = priRow[i];
    if (name && reverseNames[name]) selectedBenefits.push(reverseNames[name]);
  }

  return _json({
    success: true,
    data: {
      selectedBenefits: selectedBenefits,
      completedTasks:   _parseJSON(p.completedTasks || '{}', {}),
      currentScreen:    parseInt(priRow[9], 10) || 0,
      contactName:      priRow[1] || '',
      businessName:     priRow[2] || '',
      contactEmail:     priRow[3] || '',
      contactPhone:     priRow[4] || ''
    }
  });
}

// ── Launchpad: Save ──────────────────────────────────────────────────

function _saveLaunchpad(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = _getOrCreateSheet(ss, 'Launchpad', [
    'Location ID', 'Completed Steps', 'Step 4 Items', 'Step 5 Items',
    'Step 6 Items', 'Current Step', 'Setup Completed', 'Last Updated'
  ]);

  var row = [
    p.locationId,
    p.completedSteps || '[]',
    p.step4          || '[]',
    p.step5          || '[]',
    p.step6          || '[]',
    p.currentStep    || '1',
    p.setupCompleted || 'false',
    new Date().toISOString()
  ];

  _upsertRow(sheet, p.locationId, row);
  return _json({ success: true });
}

// ── Launchpad: Load ──────────────────────────────────────────────────

function _loadLaunchpad(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Launchpad');
  if (!sheet) return _json({ success: true, data: null });

  var row = _findRow(sheet, p.locationId);
  if (!row) return _json({ success: true, data: null });

  return _json({
    success: true,
    data: {
      completedSteps:   _parseJSON(row[1], []),
      subCheckboxState: {
        step4: _parseJSON(row[2], []),
        step5: _parseJSON(row[3], []),
        step6: _parseJSON(row[4], [])
      },
      currentStep:    parseInt(row[5], 10) || 1,
      setupCompleted: row[6] === 'true'
    }
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

function _getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _findRow(sheet, locationId) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === locationId) return data[i];
  }
  return null;
}

function _upsertRow(sheet, locationId, rowValues) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === locationId) {
      sheet.getRange(i + 1, 1, 1, rowValues.length).setValues([rowValues]);
      return;
    }
  }
  sheet.appendRow(rowValues);
}

function _buildBenefitLookup(taskSheet) {
  var lookup = {};
  if (!taskSheet) return lookup;
  var data = taskSheet.getDataRange().getValues();
  var keyMap = {
    'gmc': 'get-more-clients', 'nml': 'never-miss-leads',
    'cbc': 'communicate-best', 'gpf': 'get-paid-faster',
    'st':  'save-time',        'gt':  'grow-team',
    'lu':  'level-up'
  };
  for (var i = 1; i < data.length; i++) {
    var taskId = data[i][2];
    var benefitName = data[i][1];
    if (taskId && benefitName) {
      var prefix = taskId.replace(/-\d+$/, '');
      if (keyMap[prefix]) lookup[keyMap[prefix]] = benefitName;
    }
  }
  return lookup;
}

function _parseJSON(str, fallback) {
  try { return JSON.parse(str); }
  catch (e) { return fallback; }
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
