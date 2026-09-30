# Module Import Fixes for Backend Deployment

This document outlines the module import issues found during deployment readiness check and provides fixes.

## Issues Found

### 1. Missing `candidate.middleware.js`
**File**: `backend/src/modules/candidate/candidate.middleware.js`  
**Error**: Module not found when importing from `enhancedBooking.routes.js`

**Solution**: Created the middleware file with basic candidate access control.

### 2. CommonJS vs ES Module Conflicts

#### Issue: `slot.model.js`
**Problem**: Uses CommonJS (`require`, `module.exports`) but imported as ES module
**File**: `backend/src/modules/scheduling/slot.model.js`

**Before (CommonJS)**:
```javascript
const mongoose = require("mongoose");
// ... schema definition ...
module.exports = Slot;
```

**After (ES Module)**:
```javascript
import mongoose from "mongoose";
// ... schema definition ...
export default Slot;
```

#### Issue: `slotTemplate.model.js`
**Problem**: Likely has same issue (needs verification)
**File**: `backend/src/modules/scheduling/slotTemplate.model.js`

**Solution**: Convert to ES module syntax (see below).

## How to Fix Module Import Issues

### Step 1: Identify Problem Files

Run this command to check for import issues:
```bash
cd backend
node -e "import('./src/app.js').then(() => console.log('✅ OK')).catch(err => console.error('❌', err.message.split('\\n')[0]))"
```

### Step 2: Convert CommonJS to ES Modules

For each problematic file:

1. **Change require to import**:
   ```javascript
   // BEFORE
   const mongoose = require("mongoose");
   const SomeModule = require("./some.module");
   
   // AFTER
   import mongoose from "mongoose";
   import SomeModule from "./some.module";
   ```

2. **Change module.exports to export**:
   ```javascript
   // BEFORE
   module.exports = Model;
   module.exports = { Model, helper };
   
   // AFTER
   export default Model;
   export { Model, helper };
   ```

3. **Update imports in other files**:
   ```javascript
   // BEFORE (if using named exports)
   const { something } = require("./module");
   
   // AFTER
   import { something } from "./module";
   ```

### Step 3: Check for Other CommonJS Patterns

Look for these patterns that need conversion:

1. **`__dirname` and `__filename`**:
   ```javascript
   // BEFORE (CommonJS)
   const __dirname = path.dirname(__filename);
   
   // AFTER (ES Module)
   import { fileURLToPath } from 'url';
   import { dirname } from 'path';
   const __filename = fileURLToPath(import.meta.url);
   const __dirname = dirname(__filename);
   ```

2. **Dynamic imports**:
   ```javascript
   // BEFORE
   const module = require(variable);
   
   // AFTER
   const module = await import(variable);
   ```

## Files That Need Attention

Based on our testing, these files likely need fixes:

1. `src/modules/scheduling/slotTemplate.model.js` ✓
2. Any other `.js` files in:
   - `src/modules/` 
   - `src/config/`
   - `src/middleware/`

## Automated Conversion Script

Create `convert-to-esm.js`:

```javascript
import fs from 'fs';
import path from 'path';

function convertFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace requires with imports
  content = content.replace(
    /const (\w+) = require\(['"]([^'"]+)['"]\);/g,
    'import $1 from "$2";'
  );
  
  // Replace module.exports
  content = content.replace(
    /module\.exports = (\w+);/g,
    'export default $1;'
  );
  
  // Replace exports.object
  content = content.replace(
    /exports\.(\w+) = (\w+);/g,
    'export const $1 = $2;'
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Converted: ${filePath}`);
}

// Find all JS files
const jsFiles = [];
function findJSFiles(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findJSFiles(filePath);
    } else if (file.endsWith('.js')) {
      jsFiles.push(filePath);
    }
  });
}

findJSFiles('src');
jsFiles.forEach(convertFile);
```

Run with:
```bash
cd backend
node convert-to-esm.js
```

**Warning**: Always backup files before running automated conversion!

## Verification

After fixing imports:

1. **Test imports**:
   ```bash
   cd backend
   node -e "import('./src/app.js').then(() => console.log('✅ All imports work')).catch(console.error)"
   ```

2. **Test server startup**:
   ```bash
   npm run dev
   ```

3. **Test API endpoints**:
   ```bash
   curl http://localhost:5000/api/health
   ```

## Common Errors and Solutions

### Error: "Cannot find module"
- Check file paths are correct
- Ensure file exists
- Check for typos in import paths

### Error: "The requested module does not provide an export named 'default'"
- File is using CommonJS but imported as ES module
- Convert file to ES module syntax

### Error: "Unexpected token 'export'"
- File is using ES module but Node.js expects CommonJS
- Ensure `package.json` has `"type": "module"`
- Or rename file to `.mjs` extension

### Error: "require is not defined"
- Using `require()` in ES module
- Replace with `import`

## Best Practices for Future Development

1. **Use ES modules consistently**:
   - All new `.js` files should use `import/export`
   - Set `"type": "module"` in `package.json`

2. **File naming**:
   - Use `.js` for ES modules
   - Use `.cjs` for CommonJS modules (if needed)

3. **Import paths**:
   - Always use relative paths with file extensions
   - Example: `import Module from './module.js'`

4. **Directory structure**:
   - Each module should have its own directory
   - Include `index.js` for module exports

## Testing After Fixes

Run these tests to ensure everything works:

```bash
# 1. Check all imports
cd backend
node health-check.js

# 2. Start development server
npm run dev

# 3. Test API endpoints
curl http://localhost:5000/api/health
curl http://localhost:5000/api/interviews/slots

# 4. Run tests
npm test
```

## Support

If issues persist:
1. Check Node.js version (18+ required for ES modules)
2. Verify `package.json` has `"type": "module"`
3. Check for mixed module syntax in the codebase
4. Review import/export statements for consistency

---

**Last Updated**: September 30, 2026  
**Status**: Work in Progress (slotTemplate.model.js needs fixing)