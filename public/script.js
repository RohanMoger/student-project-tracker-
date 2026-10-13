const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

const STORAGE_KEY = 'workshop-projects-v1';

// Store projects in memory and load saved records on startup.
const projects = [];
let editingId = null;

// Show an accessible message without inserting HTML.
function showMessage(text) {
  if (message) {
    message.textContent = text;
  }
}

// Generate a unique ID for each new project.
function generateProjectId() {
  return crypto.randomUUID();
}

// Check that stored data contains valid project records.
function isValidProjectArray(data) {
  if (!Array.isArray(data)) {
    return false;
  }

  const ids = new Set();

  return data.every(project => {
    if (
      project === null ||
      typeof project !== 'object' ||
      Array.isArray(project) ||
      typeof project.id !== 'string' ||
      project.id.trim() === '' ||
      typeof project.name !== 'string' ||
      project.name.trim() === '' ||
      !['Planned', 'In Progress', 'Completed'].includes(
        project.status
      ) ||
      ids.has(project.id)
    ) {
      return false;
    }

    ids.add(project.id);
    return true;
  });
}

// Load saved projects without overwriting invalid stored data.
function loadProjects() {
  let savedText;

  try {
    savedText = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    showMessage(
      'Could not read saved projects. Browser storage may be unavailable.'
    );
    return;
  }

  // No saved data means this is a new collection.
  if (savedText === null) {
    return;
  }

  let savedProjects;

  try {
    savedProjects = JSON.parse(savedText);
  } catch (error) {
    showMessage(
      'Saved project data is malformed. It has been left unchanged. ' +
      'Do not add or edit projects until you have recovered or cleared the invalid saved data.'
    );
    return;
  }

  if (!isValidProjectArray(savedProjects)) {
    showMessage(
      'Saved project data is invalid. It has been left unchanged. ' +
      'Do not add or edit projects until you have recovered or cleared the invalid saved data.'
    );
    return;
  }

  projects.push(...savedProjects);
}

// Save the current collection as JSON text.
function saveProjects() {
  try {
    const savedText = JSON.stringify(projects);
    localStorage.setItem(STORAGE_KEY, savedText);
    return true;
  } catch (error) {
    showMessage(
      'Changes could not be saved to browser storage. ' +
      'They may be lost if you refresh the page.'
    );
    return false;
  }
}

// Return the form to Add mode.
function resetFormMode() {
  editingId = null;
  form.reset();
  saveButton.textContent = 'Save Project';
  cancelButton.hidden = true;
}

// Display all projects and their action buttons.
function renderProjects() {
  projectList.replaceChildren();

  projects.forEach(project => {
    const listItem = document.createElement('li');

    const projectName = document.createElement('span');
    projectName.textContent = project.name;

    const projectStatus = document.createElement('span');
    projectStatus.textContent = ` — ${project.status}`;

    // Edit button.
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';

    editButton.addEventListener('click', () => {
      const selectedProject = projects.find(
        item => item.id === project.id
      );

      if (!selectedProject) {
        return;
      }

      editingId = selectedProject.id;
      nameInput.value = selectedProject.name;
      statusInput.value = selectedProject.status;

      saveButton.textContent = 'Save changes';
      cancelButton.hidden = false;
      nameInput.focus();
    });

    // Delete button.
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';

    deleteButton.addEventListener('click', () => {
      const selectedProject = projects.find(
        item => item.id === project.id
      );

      if (!selectedProject) {
        return;
      }

      const confirmed = window.confirm(
        `Delete the project "${selectedProject.name}"?`
      );

      // Cancelling does not change memory or storage.
      if (!confirmed) {
        return;
      }

      // Exit edit mode if this is the project being edited.
      if (editingId === selectedProject.id) {
        resetFormMode();
      }

      const projectIndex = projects.findIndex(
        item => item.id === selectedProject.id
      );

      if (projectIndex === -1) {
        return;
      }

      projects.splice(projectIndex, 1);

      // Save only after a confirmed deletion.
      const saved = saveProjects();
      renderProjects();

      if (saved) {
        showMessage('');
      }
    });

    listItem.append(
      projectName,
      projectStatus,
      editButton,
      deleteButton
    );

    projectList.appendChild(listItem);
  });

  if (emptyState) {
    emptyState.hidden = projects.length > 0;
  }
}

// Handle both adding and editing with one submit listener.
form.addEventListener('submit', event => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const status = statusInput.value;

  if (!name) {
    showMessage('Please enter a project name.');
    nameInput.focus();
    return;
  }

  if (editingId === null) {
    // Add a new project.
    projects.push({
      id: generateProjectId(),
      name: name,
      status: status
    });
  } else {
    // Update the existing project without changing its ID.
    const project = projects.find(
      item => item.id === editingId
    );

    if (!project) {
      resetFormMode();
      renderProjects();
      showMessage(
        'The project being edited could not be found.'
      );
      return;
    }

    project.name = name;
    project.status = status;
  }

  // Save the updated collection, then redraw the list.
  const saved = saveProjects();

  renderProjects();
  resetFormMode();

  if (saved) {
    showMessage('');
  }
});

// Cancel editing without saving or changing stored records.
cancelButton.addEventListener('click', () => {
  resetFormMode();
  showMessage('');
});

// Restore saved projects, then display them.
loadProjects();
renderProjects();