/* app.js */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const selectValType = document.getElementById('validation-type');
  const rulesContainer = document.getElementById('rules-container');
  const ruleGroups = document.querySelectorAll('.rule-group');
  const regexDisplay = document.getElementById('regex-display');
  const btnCopy = document.getElementById('btn-copy');
  const explanationList = document.getElementById('explanation-list');
  const testInput = document.getElementById('test-input');
  const testBadge = document.getElementById('test-badge');
  const testFeedback = document.getElementById('test-feedback');
  
  // Custom Block Builder Elements
  const btnBlocks = document.querySelectorAll('.btn-block');
  const blockChain = document.getElementById('block-chain');

  // --- State ---
  let currentRegexStr = '^$';
  let customBlocks = []; // Array of block objects: { id, type, value, repeatType, repeatMin, repeatMax }
  let blockIdCounter = 0;

  // --- Event Listeners ---
  selectValType.addEventListener('change', handleValidationTypeChange);
  btnCopy.addEventListener('click', copyRegexToClipboard);
  testInput.addEventListener('input', runLiveTest);

  // Set up listeners on all inputs in rule groups to automatically regenerate regex
  rulesContainer.addEventListener('input', (e) => {
    // Exclude custom block inputs which have specialized handlers
    if (!e.target.closest('#rules-custom')) {
      generateRegex();
    }
  });
  rulesContainer.addEventListener('change', (e) => {
    if (!e.target.closest('#rules-custom')) {
      // Toggle sub-option visibility
      if (e.target.id === 'email-restrict-domain') {
        const domainWrapper = document.getElementById('email-domain-wrapper');
        domainWrapper.classList.toggle('hidden', !e.target.checked);
      }
      generateRegex();
    }
  });

  // Custom block button clicks
  btnBlocks.forEach(btn => {
    btn.addEventListener('click', () => {
      addCustomBlock(btn.dataset.type);
    });
  });

  // Initialize
  handleValidationTypeChange();

  // --- Handlers & Core Functions ---

  function handleValidationTypeChange() {
    const valType = selectValType.value;
    
    // Hide all rule groups, show selected
    ruleGroups.forEach(group => {
      group.classList.remove('active');
    });
    const activeGroup = document.getElementById(`rules-password`);
    
    const targetGroup = document.getElementById(`rules-${valType}`);
    if (targetGroup) {
      targetGroup.classList.add('active');
    }

    // Reset test input
    testInput.value = '';
    
    // Generate Regex & explanation
    generateRegex();
  }

  function generateRegex() {
    const valType = selectValType.value;
    let regex = '^$';
    let explanation = [];

    switch (valType) {
      case 'password':
        ({ regex, explanation } = buildPasswordRegex());
        break;
      case 'email':
        ({ regex, explanation } = buildEmailRegex());
        break;
      case 'phone':
        ({ regex, explanation } = buildPhoneRegex());
        break;
      case 'date':
        ({ regex, explanation } = buildDateRegex());
        break;
      case 'ip':
        ({ regex, explanation } = buildIPRegex());
        break;
      case 'url':
        ({ regex, explanation } = buildURLRegex());
        break;
      case 'custom':
        ({ regex, explanation } = buildCustomRegex());
        break;
    }

    currentRegexStr = regex;
    regexDisplay.textContent = regex;
    renderExplanation(explanation);
    runLiveTest();
  }

  // --- Regex Builders & Explanations ---

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 1. Password
  function buildPasswordRegex() {
    const minLenChk = document.getElementById('pwd-min-len-chk').checked;
    const minLenVal = parseInt(document.getElementById('pwd-min-len-val').value, 10) || 8;
    const reqUpper = document.getElementById('pwd-upper').checked;
    const reqLower = document.getElementById('pwd-lower').checked;
    const reqDigit = document.getElementById('pwd-digit').checked;
    const reqSpecial = document.getElementById('pwd-special').checked;

    let parts = [];
    let explanation = [{ token: '^', desc: 'Assert start of string' }];

    if (reqUpper) {
      parts.push('(?=.*[A-Z])');
      explanation.push({ token: '(?=.*[A-Z])', desc: 'Require at least one uppercase letter' });
    }
    if (reqLower) {
      parts.push('(?=.*[a-z])');
      explanation.push({ token: '(?=.*[a-z])', desc: 'Require at least one lowercase letter' });
    }
    if (reqDigit) {
      parts.push('(?=.*\\d)');
      explanation.push({ token: '(?=.*\\d)', desc: 'Require at least one numeric digit' });
    }
    if (reqSpecial) {
      parts.push('(?=.*[!@#$%^&*])');
      explanation.push({ token: '(?=.*[!@#$%^&*])', desc: 'Require at least one special character (from: !@#$%^&*)' });
    }

    const lenPart = minLenChk ? `.{${minLenVal},}` : '.*';
    explanation.push({ 
      token: lenPart, 
      desc: minLenChk ? `Match any character sequence of minimum length ${minLenVal}` : 'Match any sequence of characters' 
    });

    explanation.push({ token: '$', desc: 'Assert end of string' });

    const regex = '^' + parts.join('') + lenPart + '$';
    return { regex, explanation };
  }

  // 2. Email
  function buildEmailRegex() {
    const allowPlus = document.getElementById('email-plus-alias').checked;
    const restrictDomain = document.getElementById('email-restrict-domain').checked;
    const domainVal = document.getElementById('email-domain-val').value.trim();

    let localPart = allowPlus ? '[a-zA-Z0-9._%+-]+' : '[a-zA-Z0-9._%-]+';
    let domainPart = '[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}';

    let explanation = [
      { token: '^', desc: 'Assert start of string' },
      { token: localPart, desc: `Match local part (letters, digits, dots, underscores, dashes${allowPlus ? ', pluses' : ''})` },
      { token: '@', desc: 'Match literal @ symbol' }
    ];

    if (restrictDomain && domainVal) {
      const escapedDomain = escapeRegExp(domainVal);
      domainPart = escapedDomain;
      explanation.push({ token: domainPart, desc: `Restrict matches strictly to domain: "${domainVal}"` });
    } else {
      explanation.push(
        { token: '[a-zA-Z0-9.-]+', desc: 'Match domain name label' },
        { token: '\\.', desc: 'Match literal dot (.)' },
        { token: '[a-zA-Z]{2,}', desc: 'Match top-level domain (e.g. com, org, net, min 2 characters)' }
      );
    }

    explanation.push({ token: '$', desc: 'Assert end of string' });
    const regex = '^' + localPart + '@' + domainPart + '$';
    return { regex, explanation };
  }

  // 3. Phone Number
  function buildPhoneRegex() {
    const requireCC = document.getElementById('phone-cc').checked;
    const allowSeps = document.getElementById('phone-seps').checked;
    const exactLen = document.getElementById('phone-len-chk').checked;

    let regex = '^';
    let explanation = [{ token: '^', desc: 'Assert start of string' }];

    // Country code
    if (requireCC) {
      regex += '\\+\\d{1,3}[- .]?';
      explanation.push({ token: '\\+\\d{1,3}[- .]?', desc: 'Require country code starting with + (1 to 3 digits) followed by optional space, dash, or dot' });
    } else {
      regex += '(?:\\+\\d{1,3}[- .]?)?';
      explanation.push({ token: '(?:\\+\\d{1,3}[- .]?)?', desc: 'Optional country code (+ and 1-3 digits) with optional separator' });
    }

    // Body digits
    if (exactLen) {
      if (allowSeps) {
        regex += '\\(?\\d{3}\\)?[- .]?\\d{3}[- .]?\\d{4}';
        explanation.push(
          { token: '\\(?\\d{3}\\)?', desc: 'Area code: 3 digits optionally enclosed in parentheses' },
          { token: '[- .]?', desc: 'Optional separator (space, dash, or dot)' },
          { token: '\\d{3}', desc: 'Match next 3 digits' },
          { token: '[- .]?', desc: 'Optional separator' },
          { token: '\\d{4}', desc: 'Match last 4 digits' }
        );
      } else {
        regex += '\\d{10}';
        explanation.push({ token: '\\d{10}', desc: 'Exactly 10 numeric digits with no separators' });
      }
    } else {
      // Freeform length
      if (allowSeps) {
        regex += '\\(?[0-9]{1,4}\\)?(?:[- .]?[0-9]){4,14}';
        explanation.push({ token: '...', desc: 'Match a sequence of digits and separators containing 5 to 18 numbers total' });
      } else {
        regex += '\\d{5,15}';
        explanation.push({ token: '\\d{5,15}', desc: 'Match between 5 and 15 digits' });
      }
    }

    regex += '$';
    explanation.push({ token: '$', desc: 'Assert end of string' });
    return { regex, explanation };
  }

  // 4. Date
  function buildDateRegex() {
    const format = document.getElementById('date-format').value;
    const sep = document.getElementById('date-sep').value;

    let sepChar = '[-/]';
    let sepDesc = 'dash (-) or slash (/)';
    if (sep === 'dash') {
      sepChar = '-';
      sepDesc = 'dash (-)';
    } else if (sep === 'slash') {
      sepChar = '/';
      sepDesc = 'slash (/)';
    }

    let regex = '^';
    let explanation = [{ token: '^', desc: 'Assert start of string' }];

    const yearPart = '\\d{4}';
    const monthPart = '(?:0[1-9]|1[0-2])';
    const dayPart = '(?:0[1-9]|[12]\\d|3[01])';

    if (format === 'yyyy-mm-dd') {
      regex += `${yearPart}${sepChar}${monthPart}${sepChar}${dayPart}`;
      explanation.push(
        { token: '\\d{4}', desc: 'Match 4-digit Year (e.g. 2026)' },
        { token: sepChar, desc: `Match separator: ${sepDesc}` },
        { token: '(?:0[1-9]|1[0-2])', desc: 'Match Month (01 to 12)' },
        { token: sepChar, desc: `Match separator: ${sepDesc}` },
        { token: '(?:0[1-9]|[12]\\d|3[01])', desc: 'Match Day (01 to 31)' }
      );
    } else if (format === 'mm/dd/yyyy') {
      regex += `${monthPart}${sepChar}${dayPart}${sepChar}${yearPart}`;
      explanation.push(
        { token: '(?:0[1-9]|1[0-2])', desc: 'Match Month (01 to 12)' },
        { token: sepChar, desc: `Match separator: ${sepDesc}` },
        { token: '(?:0[1-9]|[12]\\d|3[01])', desc: 'Match Day (01 to 31)' },
        { token: sepChar, desc: `Match separator: ${sepDesc}` },
        { token: '\\d{4}', desc: 'Match 4-digit Year (e.g. 2026)' }
      );
    } else { // dd/mm/yyyy
      regex += `${dayPart}${sepChar}${monthPart}${sepChar}${yearPart}`;
      explanation.push(
        { token: '(?:0[1-9]|[12]\\d|3[01])', desc: 'Match Day (01 to 31)' },
        { token: sepChar, desc: `Match separator: ${sepDesc}` },
        { token: '(?:0[1-9]|1[0-2])', desc: 'Match Month (01 to 12)' },
        { token: sepChar, desc: `Match separator: ${sepDesc}` },
        { token: '\\d{4}', desc: 'Match 4-digit Year (e.g. 2026)' }
      );
    }

    regex += '$';
    explanation.push({ token: '$', desc: 'Assert end of string' });
    return { regex, explanation };
  }

  // 5. IP Address
  function buildIPRegex() {
    const isIPv6 = document.getElementById('ip-v6').checked;
    let regex = '';
    let explanation = [{ token: '^', desc: 'Assert start of string' }];

    if (!isIPv6) {
      regex = '^(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$';
      explanation.push(
        { token: '(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}', desc: 'Match exactly three numbers (0 to 255) followed by dots' },
        { token: '(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)', desc: 'Match the final number (0 to 255)' }
      );
    } else {
      regex = '^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$';
      explanation.push(
        { token: '(?:[0-9a-fA-F]{1,4}:){7}', desc: 'Match exactly seven colon-separated hexadecimal groups (1 to 4 characters each)' },
        { token: '[0-9a-fA-F]{1,4}', desc: 'Match the final hexadecimal group' }
      );
    }
    explanation.push({ token: '$', desc: 'Assert end of string' });
    return { regex, explanation };
  }

  // 6. URL
  function buildURLRegex() {
    const protoReq = document.getElementById('url-protocol-req').checked;
    const allowWWW = document.getElementById('url-www').checked;
    const allowParams = document.getElementById('url-params').checked;

    let regex = '^';
    let explanation = [{ token: '^', desc: 'Assert start of string' }];

    if (protoReq) {
      regex += 'https?://';
      explanation.push({ token: 'https?://', desc: 'Require http:// or https://' });
    } else {
      regex += '(?:https?://)?';
      explanation.push({ token: '(?:https?://)?', desc: 'Optional http:// or https://' });
    }

    if (allowWWW) {
      regex += '(?:www\\.)?';
      explanation.push({ token: '(?:www\\.)?', desc: 'Optional www. prefix' });
    }

    regex += '[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(?::\\d+)?';
    explanation.push(
      { token: '[a-zA-Z0-9.-]+', desc: 'Domain name' },
      { token: '\\.[a-zA-Z]{2,}', desc: 'Top-level domain (e.g. .com, .org, min 2 chars)' },
      { token: '(?::\\d+)?', desc: 'Optional port specification (e.g. :8080)' }
    );

    if (allowParams) {
      regex += '(?:\\/[^\\s]*)?';
      explanation.push({ token: '(?:\\/[^\\s]*)?', desc: 'Optional path, query strings, and hashes' });
    } else {
      regex += '(?:\\/[a-zA-Z0-9-._~%]*)*';
      explanation.push({ token: '(?:\\/[a-zA-Z0-9-._~%]*)*', desc: 'Optional directory paths with no parameters' });
    }

    regex += '$';
    explanation.push({ token: '$', desc: 'Assert end of string' });
    return { regex, explanation };
  }

  // 7. Custom Block Builder
  function buildCustomRegex() {
    if (customBlocks.length === 0) {
      return { 
        regex: '^$', 
        explanation: [
          { token: '^', desc: 'Assert start of string' },
          { token: '$', desc: 'Assert end of string' }
        ] 
      };
    }

    let regex = '';
    let explanation = [];

    // Check if start anchor exists as first item or end anchor exists as last item
    const hasStart = customBlocks[0]?.type === 'start';
    const hasEnd = customBlocks[customBlocks.length - 1]?.type === 'end';

    let startIndex = 0;
    if (hasStart) {
      regex += '^';
      explanation.push({ token: '^', desc: 'Assert start of string' });
      startIndex = 1;
    }

    for (let i = startIndex; i < customBlocks.length; i++) {
      const block = customBlocks[i];
      if (block.type === 'end' && i === customBlocks.length - 1) {
        break; // handled at the end
      }
      if (block.type === 'start') {
        // Skip misplaced starts
        continue;
      }

      let pattern = '';
      let desc = '';

      switch (block.type) {
        case 'text':
          const textVal = block.value || '';
          pattern = escapeRegExp(textVal);
          desc = `Match literal text "${textVal || 'empty'}"`;
          break;
        case 'digits':
          pattern = '\\d';
          desc = 'Match numeric digit';
          break;
        case 'letters':
          pattern = '[a-zA-Z]';
          desc = 'Match alphabetical letter (case-insensitive)';
          break;
        case 'whitespace':
          pattern = '\\s';
          desc = 'Match any whitespace (space, tab)';
          break;
        case 'any':
          pattern = '.';
          desc = 'Match any single character';
          break;
      }

      // Add repetition
      if (block.type !== 'text') {
        const rep = getRepetitionPattern(block);
        pattern = wrapPattern(pattern, rep.isGroupRequired) + rep.suffix;
        desc += ` (${rep.desc})`;
      }

      regex += pattern;
      explanation.push({ token: pattern, desc: desc });
    }

    if (hasEnd) {
      regex += '$';
      explanation.push({ token: '$', desc: 'Assert end of string' });
    }

    return { regex, explanation };
  }

  function wrapPattern(pattern, needsGroup) {
    return needsGroup ? `(?:${pattern})` : pattern;
  }

  function getRepetitionPattern(block) {
    const type = block.repeatType;
    const min = parseInt(block.repeatMin, 10) || 0;
    const max = parseInt(block.repeatMax, 10) || 0;

    switch (type) {
      case 'oneOrMore':
        return { suffix: '+', desc: '1 or more times', isGroupRequired: false };
      case 'zeroOrMore':
        return { suffix: '*', desc: '0 or more times', isGroupRequired: false };
      case 'optional':
        return { suffix: '?', desc: 'optional (0 or 1 time)', isGroupRequired: false };
      case 'exact':
        return { suffix: `{${min}}`, desc: `exactly ${min} times`, isGroupRequired: false };
      case 'range':
        return { suffix: `{${min},${max}}`, desc: `between ${min} and ${max} times`, isGroupRequired: false };
      case 'atLeast':
        return { suffix: `{${min},}`, desc: `at least ${min} times`, isGroupRequired: false };
      default:
        return { suffix: '', desc: 'exactly 1 time', isGroupRequired: false };
    }
  }

  // --- Rendering UI Updates ---

  function renderExplanation(items) {
    explanationList.innerHTML = '';
    if (items.length === 0) {
      explanationList.innerHTML = '<div class="explanation-placeholder">Configure settings to see breakdown.</div>';
      return;
    }

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'explanation-item';

      const tokenSpan = document.createElement('span');
      tokenSpan.className = 'regex-token';
      tokenSpan.textContent = item.token;

      const descSpan = document.createElement('span');
      descSpan.className = 'token-desc';
      descSpan.textContent = item.desc;

      div.appendChild(tokenSpan);
      div.appendChild(descSpan);
      explanationList.appendChild(div);
    });
  }

  // --- Custom Block Builder Operations ---

  function addCustomBlock(type) {
    // Check constraints: starts with can only be added once at start, ends with once at end
    if (type === 'start' && customBlocks.some(b => b.type === 'start')) {
      alert('Only one "Starts With" anchor can be added.');
      return;
    }
    if (type === 'end' && customBlocks.some(b => b.type === 'end')) {
      alert('Only one "Ends With" anchor can be added.');
      return;
    }

    const blockId = ++blockIdCounter;
    const blockObj = {
      id: blockId,
      type: type,
      value: '',
      repeatType: 'once',
      repeatMin: '1',
      repeatMax: '5'
    };

    // Correct positioning for anchors
    if (type === 'start') {
      customBlocks.unshift(blockObj);
    } else if (type === 'end') {
      customBlocks.push(blockObj);
    } else {
      // Insert before End anchor if it exists
      const endIdx = customBlocks.findIndex(b => b.type === 'end');
      if (endIdx !== -1) {
        customBlocks.splice(endIdx, 0, blockObj);
      } else {
        customBlocks.push(blockObj);
      }
    }

    renderCustomBlocks();
    generateRegex();
  }

  function removeCustomBlock(id) {
    customBlocks = customBlocks.filter(b => b.id !== id);
    renderCustomBlocks();
    generateRegex();
  }

  function moveCustomBlock(id, direction) {
    const idx = customBlocks.findIndex(b => b.id === id);
    if (idx === -1) return;
    
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= customBlocks.length) return;

    // Boundary rules for anchors
    if (customBlocks[idx].type === 'start' || customBlocks[targetIdx].type === 'start') return;
    if (customBlocks[idx].type === 'end' || customBlocks[targetIdx].type === 'end') return;

    // Swap
    const temp = customBlocks[idx];
    customBlocks[idx] = customBlocks[targetIdx];
    customBlocks[targetIdx] = temp;

    renderCustomBlocks();
    generateRegex();
  }

  function renderCustomBlocks() {
    // Save current focuses if any
    const activeId = document.activeElement ? document.activeElement.id : null;

    blockChain.innerHTML = '';
    
    if (customBlocks.length === 0) {
      blockChain.innerHTML = '<div class="empty-chain-msg">No blocks added. Click a button above to add matching rules.</div>';
      return;
    }

    customBlocks.forEach((block, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'chain-item';
      itemDiv.dataset.id = block.id;

      // Badge
      const badge = document.createElement('span');
      badge.className = 'item-badge';
      badge.textContent = block.type === 'start' ? 'Start Anchor' : block.type === 'end' ? 'End Anchor' : block.type;
      itemDiv.appendChild(badge);

      // Configuration inputs
      const configDiv = document.createElement('div');
      configDiv.className = 'item-config';

      if (block.type === 'start' || block.type === 'end') {
        const anchorLabel = document.createElement('span');
        anchorLabel.className = 'chk-label';
        anchorLabel.textContent = block.type === 'start' ? 'Assert Start of line (^)' : 'Assert End of line ($)';
        configDiv.appendChild(anchorLabel);
      } else if (block.type === 'text') {
        const label = document.createElement('label');
        label.textContent = 'Text:';
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `input-val-${block.id}`;
        input.value = block.value;
        input.placeholder = 'abc';
        input.addEventListener('input', (e) => {
          block.value = e.target.value;
          generateRegex();
        });
        configDiv.appendChild(label);
        configDiv.appendChild(input);
      } else {
        // Repeat rule options for matches
        const label = document.createElement('label');
        label.textContent = 'Repeats:';
        
        const select = document.createElement('select');
        select.id = `select-rep-${block.id}`;
        select.innerHTML = `
          <option value="once" ${block.repeatType === 'once' ? 'selected' : ''}>Exactly 1 time</option>
          <option value="optional" ${block.repeatType === 'optional' ? 'selected' : ''}>Optional (0 or 1)</option>
          <option value="oneOrMore" ${block.repeatType === 'oneOrMore' ? 'selected' : ''}>1 or more times (+)</option>
          <option value="zeroOrMore" ${block.repeatType === 'zeroOrMore' ? 'selected' : ''}>0 or more times (*)</option>
          <option value="exact" ${block.repeatType === 'exact' ? 'selected' : ''}>Exactly N times</option>
          <option value="atLeast" ${block.repeatType === 'atLeast' ? 'selected' : ''}>At least N times</option>
          <option value="range" ${block.repeatType === 'range' ? 'selected' : ''}>Between N and M times</option>
        `;

        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.id = `input-min-${block.id}`;
        minInput.value = block.repeatMin;
        minInput.min = '1';
        minInput.className = 'inline-number hidden';

        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.id = `input-max-${block.id}`;
        maxInput.value = block.repeatMax;
        maxInput.min = '1';
        maxInput.className = 'inline-number hidden';

        const updateVisibility = (val) => {
          minInput.classList.toggle('hidden', !['exact', 'atLeast', 'range'].includes(val));
          maxInput.classList.toggle('hidden', val !== 'range');
        };

        select.addEventListener('change', (e) => {
          block.repeatType = e.target.value;
          updateVisibility(block.repeatType);
          generateRegex();
        });

        minInput.addEventListener('input', (e) => {
          block.repeatMin = e.target.value;
          generateRegex();
        });

        maxInput.addEventListener('input', (e) => {
          block.repeatMax = e.target.value;
          generateRegex();
        });

        configDiv.appendChild(label);
        configDiv.appendChild(select);
        configDiv.appendChild(minInput);
        configDiv.appendChild(maxInput);
        updateVisibility(block.repeatType);
      }

      itemDiv.appendChild(configDiv);

      // Reordering & Actions
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'item-actions';
      actionsDiv.style.display = 'flex';
      actionsDiv.style.gap = '0.25rem';

      // Move Up (Only if it's not a start anchor, and not the first index, or the item after starts-with)
      const canMoveUp = block.type !== 'start' && block.type !== 'end' && index > (customBlocks[0].type === 'start' ? 1 : 0);
      if (canMoveUp) {
        const btnUp = document.createElement('button');
        btnUp.className = 'btn-remove';
        btnUp.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>`;
        btnUp.title = 'Move Up';
        btnUp.addEventListener('click', () => moveCustomBlock(block.id, -1));
        actionsDiv.appendChild(btnUp);
      }

      // Move Down
      const hasEndAnchor = customBlocks[customBlocks.length - 1].type === 'end';
      const boundaryOffset = hasEndAnchor ? 2 : 1;
      const canMoveDown = block.type !== 'start' && block.type !== 'end' && index < customBlocks.length - boundaryOffset;
      if (canMoveDown) {
        const btnDown = document.createElement('button');
        btnDown.className = 'btn-remove';
        btnDown.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>`;
        btnDown.title = 'Move Down';
        btnDown.addEventListener('click', () => moveCustomBlock(block.id, 1));
        actionsDiv.appendChild(btnDown);
      }

      // Remove
      const btnDel = document.createElement('button');
      btnDel.className = 'btn-remove';
      btnDel.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
      btnDel.title = 'Remove block';
      btnDel.addEventListener('click', () => removeCustomBlock(block.id));
      actionsDiv.appendChild(btnDel);

      itemDiv.appendChild(actionsDiv);
      blockChain.appendChild(itemDiv);
    });

    // Restore focus
    if (activeId) {
      const el = document.getElementById(activeId);
      if (el) el.focus();
    }
  }

  // --- Copying Regex ---

  function copyRegexToClipboard() {
    navigator.clipboard.writeText(currentRegexStr).then(() => {
      const tooltip = btnCopy.querySelector('.copy-tooltip');
      const originalText = tooltip.textContent;
      tooltip.textContent = 'Copied!';
      btnCopy.classList.add('copied');
      
      setTimeout(() => {
        tooltip.textContent = originalText;
        btnCopy.classList.remove('copied');
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  // --- Live Testing Engine ---

  function runLiveTest() {
    const text = testInput.value;
    
    // Remove old classes
    testInput.classList.remove('input-valid', 'input-invalid');
    testBadge.className = 'test-badge';

    if (text === '') {
      testBadge.classList.add('neutral');
      testBadge.querySelector('.badge-text').textContent = 'Empty Input';
      testFeedback.innerHTML = '<div class="feedback-placeholder">Type something to test this pattern.</div>';
      return;
    }

    try {
      const regex = new RegExp(currentRegexStr);
      const isValid = regex.test(text);

      if (isValid) {
        testInput.classList.add('input-valid');
        testBadge.classList.add('valid');
        testBadge.querySelector('.badge-text').textContent = 'Valid Match';
        
        // Show validation rules that are passed successfully
        renderValidFeedback(text);
      } else {
        testInput.classList.add('input-invalid');
        testBadge.classList.add('invalid');
        testBadge.querySelector('.badge-text').textContent = 'No Match';
        
        // Explain why the match failed
        renderInvalidFeedback(text);
      }
    } catch (e) {
      testBadge.classList.add('neutral');
      testBadge.querySelector('.badge-text').textContent = 'Regex Error';
      testFeedback.innerHTML = `<div class="feedback-placeholder error">Invalid regular expression: ${e.message}</div>`;
    }
  }

  function renderValidFeedback(text) {
    const valType = selectValType.value;
    let listHTML = '<div class="feedback-list">';

    if (valType === 'password') {
      const minLenChk = document.getElementById('pwd-min-len-chk').checked;
      const minLenVal = parseInt(document.getElementById('pwd-min-len-val').value, 10) || 8;
      const reqUpper = document.getElementById('pwd-upper').checked;
      const reqLower = document.getElementById('pwd-lower').checked;
      const reqDigit = document.getElementById('pwd-digit').checked;
      const reqSpecial = document.getElementById('pwd-special').checked;

      listHTML += `<div class="feedback-item success"><span class="feedback-icon">✓</span> Password meets all checked requirements:</div>`;
      if (minLenChk) listHTML += `<div class="feedback-item success" style="padding-left:1.5rem;"><span class="feedback-icon">✓</span> Length is ${text.length} (minimum ${minLenVal})</div>`;
      if (reqUpper) listHTML += `<div class="feedback-item success" style="padding-left:1.5rem;"><span class="feedback-icon">✓</span> Contains uppercase letter</div>`;
      if (reqLower) listHTML += `<div class="feedback-item success" style="padding-left:1.5rem;"><span class="feedback-icon">✓</span> Contains lowercase letter</div>`;
      if (reqDigit) listHTML += `<div class="feedback-item success" style="padding-left:1.5rem;"><span class="feedback-icon">✓</span> Contains numeric digit</div>`;
      if (reqSpecial) listHTML += `<div class="feedback-item success" style="padding-left:1.5rem;"><span class="feedback-icon">✓</span> Contains special character</div>`;
    } else {
      listHTML += `<div class="feedback-item success"><span class="feedback-icon">✓</span> String matches the pattern successfully!</div>`;
    }

    listHTML += '</div>';
    testFeedback.innerHTML = listHTML;
  }

  function renderInvalidFeedback(text) {
    const valType = selectValType.value;
    let listHTML = '<div class="feedback-list">';

    if (valType === 'password') {
      const minLenChk = document.getElementById('pwd-min-len-chk').checked;
      const minLenVal = parseInt(document.getElementById('pwd-min-len-val').value, 10) || 8;
      const reqUpper = document.getElementById('pwd-upper').checked;
      const reqLower = document.getElementById('pwd-lower').checked;
      const reqDigit = document.getElementById('pwd-digit').checked;
      const reqSpecial = document.getElementById('pwd-special').checked;

      listHTML += `<div class="feedback-item error"><span class="feedback-icon">✕</span> Requirements not met:</div>`;

      if (minLenChk && text.length < minLenVal) {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Need at least ${minLenVal} characters (currently ${text.length})</div>`;
      }
      if (reqUpper && !/[A-Z]/.test(text)) {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Must contain at least one uppercase letter</div>`;
      }
      if (reqLower && !/[a-z]/.test(text)) {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Must contain at least one lowercase letter</div>`;
      }
      if (reqDigit && !/\d/.test(text)) {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Must contain at least one number</div>`;
      }
      if (reqSpecial && !/[!@#$%^&*]/.test(text)) {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Must contain at least one special character (!@#$%^&*)</div>`;
      }
    } else if (valType === 'email') {
      listHTML += `<div class="feedback-item error"><span class="feedback-icon">✕</span> Not a valid email layout:</div>`;
      if (!text.includes('@')) {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Missing '@' symbol</div>`;
      } else {
        const parts = text.split('@');
        if (parts.length > 2) {
          listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Cannot contain multiple '@' symbols</div>`;
        }
        
        const restrictDomain = document.getElementById('email-restrict-domain').checked;
        const domainVal = document.getElementById('email-domain-val').value.trim();
        if (restrictDomain && domainVal && parts[1] !== domainVal) {
          listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Domain must be exactly "${domainVal}" (currently "${parts[1] || 'none'}")</div>`;
        }
        
        if (parts[1] && !parts[1].includes('.')) {
          listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Domain name is missing extension (e.g. .com)</div>`;
        }
      }
      if (/\s/.test(text)) {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Emails cannot contain spaces</div>`;
      }
    } else if (valType === 'phone') {
      listHTML += `<div class="feedback-item error"><span class="feedback-icon">✕</span> Not a valid phone format:</div>`;
      const digitsOnly = text.replace(/\D/g, '');
      const exactLen = document.getElementById('phone-len-chk').checked;

      if (exactLen && digitsOnly.length !== 10) {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Must contain exactly 10 digits (currently ${digitsOnly.length})</div>`;
      }
      
      const allowSeps = document.getElementById('phone-seps').checked;
      if (!allowSeps && /[^0-9+]/.test(text)) {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Separators (spaces/dashes) are disabled</div>`;
      }
      
      const requireCC = document.getElementById('phone-cc').checked;
      if (requireCC && !text.startsWith('+')) {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Missing required country code starting with '+'</div>`;
      }
    } else if (valType === 'date') {
      const format = document.getElementById('date-format').value;
      const sep = document.getElementById('date-sep').value;
      
      listHTML += `<div class="feedback-item error"><span class="feedback-icon">✕</span> Invalid date layout:</div>`;
      listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Must follow format: ${format.toUpperCase()}</div>`;
      
      let allowedSeps = 'dashes (-) or slashes (/)';
      if (sep === 'dash') allowedSeps = 'dashes (-)';
      if (sep === 'slash') allowedSeps = 'slashes (/)';
      listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Separators must be: ${allowedSeps}</div>`;
    } else if (valType === 'ip') {
      const isIPv6 = document.getElementById('ip-v6').checked;
      listHTML += `<div class="feedback-item error"><span class="feedback-icon">✕</span> Invalid ${isIPv6 ? 'IPv6' : 'IPv4'} syntax:</div>`;
      
      if (!isIPv6) {
        const octets = text.split('.');
        if (octets.length !== 4) {
          listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> IPv4 must contain exactly 4 octets separated by dots (e.g. 192.168.1.1)</div>`;
        } else {
          octets.forEach((o, i) => {
            const val = parseInt(o, 10);
            if (isNaN(val) || val < 0 || val > 255 || o.trim() === '') {
              listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Octet ${i+1} ("${o}") is out of range 0-255</div>`;
            }
          });
        }
      } else {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Must be 8 groups of 1-4 hexadecimal characters (0-9, a-f) separated by colons</div>`;
      }
    } else if (valType === 'url') {
      listHTML += `<div class="feedback-item error"><span class="feedback-icon">✕</span> Invalid URL layout:</div>`;
      const protoReq = document.getElementById('url-protocol-req').checked;
      
      if (protoReq && !text.startsWith('http://') && !text.startsWith('https://')) {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> Missing required protocol prefix (http:// or https://)</div>`;
      }
      if (/\s/.test(text)) {
        listHTML += `<div class="feedback-item error" style="padding-left:1.5rem;"><span class="feedback-icon">✕</span> URLs cannot contain spaces</div>`;
      }
    } else if (valType === 'custom') {
      listHTML += `<div class="feedback-item error"><span class="feedback-icon">✕</span> Does not match the custom builder criteria sequence</div>`;
      
      // Detailed feedback per block if possible
      const hasStart = customBlocks[0]?.type === 'start';
      if (hasStart) {
        const startBlock = customBlocks[0];
        // Match start
      }
    }

    listHTML += '</div>';
    testFeedback.innerHTML = listHTML;
  }
});
