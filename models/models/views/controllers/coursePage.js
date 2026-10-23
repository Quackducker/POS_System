import { listCourses, addCourse, updateCourse, deleteCourse } from '../models/courses.js';

const form = document.getElementById('courseForm');
const rows = document.getElementById('courseRows');
let courses = [];

function showMsg(text, ok = true) {
  const box = document.getElementById('msg');
  box.textContent = text;
  box.style.background = ok ? '#dcfce7' : '#fee2e2';
  setTimeout(() => { box.textContent = ''; box.style.background = ''; }, 4000);
}

async function loadCourses() {
  const { data, error } = await listCourses();
  if (error) return showMsg(error.message, false);
  courses = data;
  rows.innerHTML = '';
  courses.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td></td><td></td><td></td>';
    tr.children[0].textContent = c.course_code;
    tr.children[1].textContent = c.course_name;
    tr.children[2].innerHTML =
      `<button data-edit='${c.course_id}'>Edit</button> <button data-delete='${c.course_id}'>Delete</button>`;
    rows.appendChild(tr);
  });
  if (courses.length === 0) rows.innerHTML = '<tr><td colspan="3">No courses yet.</td></tr>';
}

function resetForm() {
  form.reset();
  document.getElementById('courseId').value = '';
  document.getElementById('formTitle').textContent = 'Add Course';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('courseId').value;
  const course = {
    course_code: document.getElementById('code').value.trim().toUpperCase(),
    course_name: document.getElementById('name').value.trim(),
  };
  if (!course.course_code || !course.course_name) return showMsg('Both fields are required.', false);

  const { error } = id ? await updateCourse(id, course) : await addCourse(course);
  if (error) {
    return showMsg(error.code === '23505' ? 'That course code already exists.' : error.message, false);
  }
  showMsg(id ? 'Course updated.' : 'Course added.');
  resetForm();
  loadCourses();
});

rows.addEventListener('click', async (e) => {
  const editId = e.target.dataset.edit;
  const deleteId = e.target.dataset.delete;

  if (editId) {
    const c = courses.find(x => x.course_id == editId);
    document.getElementById('courseId').value = c.course_id;
    document.getElementById('code').value = c.course_code;
    document.getElementById('name').value = c.course_name;
    document.getElementById('formTitle').textContent = 'Edit Course';
  }

  if (deleteId && confirm('Delete this course?')) {
    const { error } = await deleteCourse(deleteId);
    if (error) {
      return showMsg(error.code === '23503' ? 'This course is used by customers and cannot be deleted.' : error.message, false);
    }
    showMsg('Course deleted.');
    loadCourses();
  }
});

document.getElementById('cancelBtn').addEventListener('click', resetForm);
loadCourses();