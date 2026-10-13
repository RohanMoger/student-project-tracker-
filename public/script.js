
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

// The API is the only source of project records.
const API_URL = '/api/projects';

let projects = [];
let editingId = null;
let busy = false;

// Show accessible status and error messages.
function showMessage(text) {
  message.textContent = text;
}

// Disable controls while a request is in progress.
function setBusy(value) {
  busy = value;
  saveButton.disabled = busy;
  cancelButton.disabled = busy;

  projectList.querySelectorAll('button').forEach(button => {
    button.disabled = busy;
  });
}

// Read JSON responses and provide useful HTTP/network errors.
async function requestJSON(url, options = {}) {
  let response;

  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(
      'Network error: Could not contact the server. ' +
      'Check your connection and make sure the Express server is running.'
    );
  }

  let data;

  try {
    data = await response.json();
  } catch (error) {
    if (!response.ok) {
      throw new Error(
        `Request failed with HTTP ${response.status}.`
      );
    }

    throw new Error('The server returned an invalid JSON response.');
  }

  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : `Request failed with HTTP ${response.status}.`
    );
  }

  return data;
}

// Return the form to Add mode.
function resetFormMode() {
  editingId = null;
  form.reset();
  saveButton.textContent = 'Save Project';
  cancelButton.hidden = true;
}

// Render the projects received from the API.
function renderProjects() {
  projectList.replaceChildren();

  projects.forEach(project => {
    const listItem = document.createElement('li');

    const projectName = document.createElement('span');
    projectName.textContent = project.name;

    const projectStatus = document.createElement('span');
    projectStatus.textContent = ` — ${project.status}`;

    const actions = document.createElement('div');
    actions.className = 'project-actions';

    // Edit button.
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.disabled = busy;

    editButton.addEventListener('click', () => {
      if (busy) return;

      const selectedProject = projects.find(
        item => item.id === project.id
      );

      if (!selectedProject) return;

      editingId = selectedProject.id;
      nameInput.value = selectedProject.name;
      statusInput.value = selectedProject.status;

      saveButton.textContent = 'Save changes';
      cancelButton.hidden = false;
      showMessage('Editing project.');
      nameInput.focus();
    });

    // Delete button.
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.disabled = busy;

    deleteButton.addEventListener('click', async () => {
      if (busy) return;

      const selectedProject = projects.find(
        item => item.id === project.id
      );

      if (!selectedProject) return;

      const confirmed = window.confirm(
        `Delete the project "${selectedProject.name}"?`
      );

      // Cancellation sends no request.
      if (!confirmed) return;

      setBusy(true);
      showMessage('Deleting project...');

      try {
        await requestJSON(
          `${API_URL}/${encodeURIComponent(selectedProject.id)}`,
          { method: 'DELETE' }
        );

        // Exit edit mode if the deleted project was being edited.
        if (editingId === selectedProject.id) {
          resetFormMode();
        }

        const result = await refreshProjects();

        if (result.ok) {
          showMessage('Project deleted successfully.');
        } else {
          showMessage(
            'Project deleted successfully, but the list could not ' +
            `be refreshed. ${result.error}`
          );
        }
      } catch (error) {
        // A failed deletion keeps the current list and edit form.
        showMessage(error.message);
      } finally {
        setBusy(false);
        renderProjects();
      }
    });

    actions.append(editButton, deleteButton);
    listItem.append(projectName, projectStatus, actions);
    projectList.appendChild(listItem);
  });

  // Do not show an empty-list message while a request is pending.
  emptyState.hidden = busy || projects.length > 0;
}

// Fetch the current collection without treating failures as empty data.
async function refreshProjects() {
  try {
    const data = await requestJSON(API_URL);

    if (!Array.isArray(data)) {
      throw new Error('The server returned an invalid project list.');
    }

    // Replace the collection rather than appending duplicate records.
    projects = data;

    renderProjects();

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

// Load projects from the API on startup.
async function loadProjects() {
  setBusy(true);
  emptyState.hidden = true;
  showMessage('Loading projects...');

  try {
    const result = await refreshProjects();

    if (!result.ok) {
      showMessage(`Could not load projects. ${result.error}`);
      return;
    }

    if (projects.length === 0) {
      showMessage('No projects found. Add your first project.');
    } else {
      showMessage('Projects loaded successfully.');
    }
  } finally {
    setBusy(false);
    renderProjects();
  }
}

// Send a JSON request to create or update a project.
async function saveProjectRequest(name, status) {
  const payload = { name, status };
  const isEditing = editingId !== null;

  const url = isEditing
    ? `${API_URL}/${encodeURIComponent(editingId)}`
    : API_URL;

  const options = {
    method: isEditing ? 'PUT' : 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  };

  return requestJSON(url, options);
}

// One submit listener handles both Add and Edit.
form.addEventListener('submit', async event => {
  event.preventDefault();

  if (busy) return;

  const name = nameInput.value.trim();
  const status = statusInput.value;

  if (!name) {
    showMessage('Please enter a project name.');
    nameInput.focus();
    return;
  }

  if (name.length > 80) {
    showMessage('Project name must not exceed 80 characters.');
    nameInput.focus();
    return;
  }

  if (!['Planned', 'In Progress', 'Completed'].includes(status)) {
    showMessage('Please select a valid project status.');
    statusInput.focus();
    return;
  }

  // Keep the current input and edit mode if the mutation fails.
  setBusy(true);
  showMessage(
    editingId === null ? 'Saving new project...' : 'Saving changes...'
  );

  const wasEditing = editingId !== null;

  try {
    await saveProjectRequest(name, status);

    // The mutation succeeded. It is now safe to reset the form.
    resetFormMode();

    // Fetch the authoritative collection after the mutation.
    const result = await refreshProjects();

    if (!result.ok) {
      showMessage(
        `Project ${wasEditing ? 'updated' : 'created'} successfully, ` +
        `but the list could not be refreshed. ${result.error}`
      );
      return;
    }

    showMessage(
      wasEditing
        ? 'Project updated successfully.'
        : 'Project added successfully.'
    );
  } catch (error) {
    showMessage(error.message);
  } finally {
    setBusy(false);
    renderProjects();
  }
});

// Cancel editing without sending an API request.
cancelButton.addEventListener('click', () => {
  if (busy) return;

  resetFormMode();
  showMessage('Edit cancelled.');
});

// Start by loading the server's project collection.
loadProjects();
