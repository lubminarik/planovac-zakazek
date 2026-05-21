import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, Circle, Hammer, Package, Plus, Users, BriefcaseBusiness, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const weeks = Array.from({ length: 53 }, (_, i) => i + 1);
const initialEmployees = ["Luboš", "Honza", "Petr", "Karel"];
const projectColors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500", "bg-pink-500", "bg-cyan-500", "bg-yellow-500"];
const materialStatuses = ["Objednat", "Objednáno", "Ve výrobě", "Na cestě", "Skladem", "Nainstalováno"];
const STORAGE_KEY = "planovac-zakazek-data-v1";
const ADMIN_PASSWORD = "lubos";
const SITE_PASSWORD = "stavba";

const initialProjects = [
  {
    id: "ZK-001",
    name: "BD Šibeník",
    color: projectColors[0],
    startDate: "2026-01-12",
    endDate: "2026-03-20",
    note: "Hlavní zakázka – zábradlí, paravány, madla",
    contractAmount: "1250000",
    materialAmount: "540000",
    workAmount: "430000",
    invoicedAmount: "350000",
    items: [
      {
        id: "P-001",
        name: "Celoskleněná zábradlí",
        startDate: "2026-01-12",
        endDate: "2026-02-20",
        employee: "Honza",
        tasks: [
          { id: "T-001", text: "Zaměřit", done: true, employee: "Luboš" },
          { id: "T-002", text: "Objednat sklo", done: false, employee: "Luboš" },
          { id: "T-003", text: "Montáž 1. etapa", done: false, employee: "Honza" },
        ],
        materials: [
          { id: "M-001", text: "Sklo ESG/VSG 88.2", details: "24 m² • čiré • kotvení side mount", status: "Objednat", employee: "Luboš" },
          { id: "M-002", text: "Al profil RAL 7016", details: "32 bm • komaxit mat", status: "Objednáno", employee: "Petr" },
        ],
      },
      {
        id: "P-002",
        name: "Dělící paravány",
        startDate: "2026-02-09",
        endDate: "2026-03-06",
        employee: "Petr",
        tasks: [{ id: "T-004", text: "Schválit rozměry", done: false, employee: "Luboš" }],
        materials: [{ id: "M-003", text: "Sklo mléčné", details: "12 ks • satinato", status: "Na cestě", employee: "Petr" }],
      },
    ],
  },
];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function nextId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function weekFromDate(dateString, year = null) {
  if (!dateString) return null;
  const date = new Date(`${dateString}T12:00:00`);
  const targetYear = year || date.getFullYear();
  const start = new Date(`${targetYear}-01-01T12:00:00`);
  const diffDays = Math.floor((date - start) / 86400000);
  return Math.min(53, Math.max(1, Math.floor(diffDays / 7) + 1));
}

function weekRangeForYear(startDate, endDate, year) {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const yearStart = new Date(`${year}-01-01T12:00:00`);
  const yearEnd = new Date(`${year}-12-31T12:00:00`);
  if (end < yearStart || start > yearEnd) return null;
  const visibleStart = start < yearStart ? yearStart : start;
  const visibleEnd = end > yearEnd ? yearEnd : end;
  return {
    startWeek: weekFromDate(visibleStart.toISOString().slice(0, 10), year),
    endWeek: weekFromDate(visibleEnd.toISOString().slice(0, 10), year),
  };
}

function overlapsDateRange(startDate, endDate, week, year) {
  const range = weekRangeForYear(startDate, endDate, year);
  return !!range && week >= range.startWeek && week <= range.endWeek;
}

function dateRangeLabel(startDate, endDate) {
  if (!startDate || !endDate) return "nezadaný termín";
  const format = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("cs-CZ");
  return `${format(startDate)} – ${format(endDate)}`;
}

function progress(project) {
  const tasks = project.items.flatMap((item) => item.tasks || []);
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((task) => task.done).length / tasks.length) * 100);
}

function getAutoProjectColor(projects) {
  const usedColors = projects.map((project) => project.color).filter(Boolean);
  return projectColors
    .map((color) => ({ color, count: usedColors.filter((used) => used === color).length }))
    .sort((a, b) => a.count - b.count)[0]?.color || projectColors[0];
}

function loadSavedData() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function materialStatusClass(status) {
  if (status === "Objednat") return "bg-red-200 text-red-800 border-red-300";
  if (status === "Objednáno") return "bg-blue-100 text-blue-700";
  if (status === "Ve výrobě") return "bg-orange-100 text-orange-700";
  if (status === "Na cestě") return "bg-yellow-100 text-yellow-700";
  if (status === "Skladem") return "bg-green-100 text-green-700";
  if (status === "Nainstalováno") return "bg-emerald-200 text-emerald-800";
  return "bg-slate-100 text-slate-700";
}

function blockedWeeksForEmployee(employeeAbsences, employee, year) {
  const blocked = Array(53).fill(false);
  (employeeAbsences[employee] || []).forEach((absence) => {
    weeks.forEach((week) => {
      if (overlapsDateRange(absence.startDate, absence.endDate, week, year)) {
        blocked[week - 1] = true;
      }
    });
  });
  return blocked;
}

export default function App() {
  const savedData = useMemo(() => loadSavedData(), []);
  const [employees, setEmployees] = useState(savedData?.employees || initialEmployees);
  const [employeeAbsences, setEmployeeAbsences] = useState(savedData?.employeeAbsences || {});
  const [projects, setProjects] = useState(() => {
    const loaded = savedData?.projects || initialProjects;
    return loaded.map((project, index) => ({ ...project, color: project.color || projectColors[index % projectColors.length] }));
  });
  const [selectedProjectId, setSelectedProjectId] = useState(savedData?.selectedProjectId || savedData?.projects?.[0]?.id || initialProjects[0].id);
  const [selectedItemId, setSelectedItemId] = useState(savedData?.selectedItemId || savedData?.projects?.[0]?.items?.[0]?.id || initialProjects[0].items[0].id);
  const [employeeName, setEmployeeName] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newTaskText, setNewTaskText] = useState("");
  const [newMaterialText, setNewMaterialText] = useState("");
  const [viewYear, setViewYear] = useState(savedData?.viewYear || 2026);
  const [saveStatus, setSaveStatus] = useState("Načteno");
  const [userRole, setUserRole] = useState("viewer");
  const [attendanceRecords, setAttendanceRecords] = useState(savedData?.attendanceRecords || []);
  const [attendanceEmployee, setAttendanceEmployee] = useState(savedData?.attendanceEmployee || initialEmployees[0]);
  const [attendanceProjectId, setAttendanceProjectId] = useState(savedData?.attendanceProjectId || initialProjects[0].id);
  const [attendanceMonth, setAttendanceMonth] = useState(savedData?.attendanceMonth || todayString().slice(0, 7));
  const [password, setPassword] = useState("");
  const [employeesOpen, setEmployeesOpen] = useState(false);
  const [workloadOpen, setWorkloadOpen] = useState(false);
  const fileInputRef = useRef(null);
  const canEditAll = userRole === "admin";
  const canEditSite = userRole === "admin" || userRole === "site";
  const canEdit = canEditAll;
  const currentWeek = weekFromDate(todayString(), viewYear);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || projects[0];
  const selectedItem = selectedProject?.items.find((item) => item.id === selectedItemId) || selectedProject?.items[0];
  const hasOpenAttendance = attendanceRecords.some((record) => record.employee === attendanceEmployee && !record.departure);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ employees, employeeAbsences, projects, selectedProjectId, selectedItemId, viewYear, attendanceRecords, attendanceEmployee, attendanceProjectId, attendanceMonth }));
    setSaveStatus("Uloženo");
  }, [employees, employeeAbsences, projects, selectedProjectId, selectedItemId, viewYear, attendanceRecords, attendanceEmployee, attendanceProjectId, attendanceMonth]);

  const workload = useMemo(() => {
    const map = {};
    employees.forEach((employee) => (map[employee] = Array(53).fill(0)));
    projects.forEach((project) => {
      project.items.forEach((item) => {
        weeks.forEach((week) => {
          if (overlapsDateRange(item.startDate, item.endDate, week, viewYear)) {
            map[item.employee] = map[item.employee] || Array(53).fill(0);
            map[item.employee][week - 1] += 1;
          }
        });
      });
    });
    return map;
  }, [employees, projects, viewYear]);

  const blockedWeeks = useMemo(() => {
    const map = {};
    employees.forEach((employee) => {
      map[employee] = blockedWeeksForEmployee(employeeAbsences, employee, viewYear);
    });
    return map;
  }, [employees, employeeAbsences, viewYear]);

  const dashboard = useMemo(() => {
    const today = new Date(`${todayString()}T12:00:00`);
    const parseAmount = (value) => Number(String(value || "").replace(/[^0-9.-]/g, "")) || 0;

    const allMaterials = projects.flatMap((project) =>
      project.items.flatMap((item) =>
        (item.materials || []).map((material) => ({ ...material, projectName: project.name, itemName: item.name }))
      )
    );

    const allTasks = projects.flatMap((project) => project.items.flatMap((item) => item.tasks || []));
    const doneTasks = allTasks.filter((task) => task.done).length;

    const activeProjects = projects.filter((project) => {
      const start = new Date(`${project.startDate}T12:00:00`);
      const end = new Date(`${project.endDate}T12:00:00`);
      return start <= today && today <= end;
    }).length;

    const overdueProjects = projects.filter((project) => {
      const end = new Date(`${project.endDate}T12:00:00`);
      return end < today && progress(project) < 100;
    }).length;

    const upcomingProjects = projects.filter((project) => {
      const start = new Date(`${project.startDate}T12:00:00`);
      const diffDays = Math.ceil((start - today) / 86400000);
      return diffDays >= 0 && diffDays <= 30;
    }).length;

    const materialByStatus = materialStatuses.reduce((acc, status) => {
      acc[status] = allMaterials.filter((material) => material.status === status).length;
      return acc;
    }, {});

    const finance = projects.reduce(
      (acc, project) => {
        acc.contract += parseAmount(project.contractAmount);
        acc.material += parseAmount(project.materialAmount);
        acc.work += parseAmount(project.workAmount);
        acc.invoiced += parseAmount(project.invoicedAmount);
        return acc;
      },
      { contract: 0, material: 0, work: 0, invoiced: 0 }
    );

    finance.remaining = Math.max(0, finance.contract - finance.invoiced);

    return {
      totalProjects: projects.length,
      activeProjects,
      overdueProjects,
      upcomingProjects,
      allTasks: allTasks.length,
      doneTasks,
      taskProgress: allTasks.length ? Math.round((doneTasks / allTasks.length) * 100) : 0,
      allMaterials,
      materialByStatus,
      finance,
    };
  }, [projects]);

  function money(value) {
    return new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: "CZK",
      maximumFractionDigits: 0,
    }).format(value || 0);
  }

  function updateProject(projectId, patch) {
    if (!canEditAll) return;
    setProjects((prev) => prev.map((project) => (project.id === projectId ? { ...project, ...patch } : project)));
  }

  function updateItem(projectId, itemId, patch) {
    if (!canEditSite) return;
    setProjects((prev) =>
      prev.map((project) =>
        project.id !== projectId
          ? project
          : { ...project, items: project.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) }
      )
    );
  }

  function addProject() {
    if (!canEditAll || !newProjectName.trim()) return;
    const id = nextId("ZK");
    const itemId = nextId("P");
    const project = {
      id,
      name: newProjectName.trim(),
      color: getAutoProjectColor(projects),
      startDate: todayString(),
      endDate: todayString(),
      note: "",
      contractAmount: "",
      materialAmount: "",
      workAmount: "",
      invoicedAmount: "",
      items: [{ id: itemId, name: "První položka", startDate: todayString(), endDate: todayString(), employee: employees[0] || "", tasks: [], materials: [] }],
    };
    setProjects((prev) => [...prev, project]);
    setSelectedProjectId(id);
    setSelectedItemId(itemId);
    setNewProjectName("");
  }

  function addItem() {
    if (!canEditAll || !selectedProject || !newItemName.trim()) return;
    const item = { id: nextId("P"), name: newItemName.trim(), startDate: selectedProject.startDate || todayString(), endDate: selectedProject.endDate || todayString(), employee: employees[0] || "", tasks: [], materials: [] };
    setProjects((prev) => prev.map((project) => (project.id === selectedProject.id ? { ...project, items: [...project.items, item] } : project)));
    setSelectedItemId(item.id);
    setNewItemName("");
  }

  function addTask() {
    if (!canEditSite || !selectedProject || !selectedItem || !newTaskText.trim()) return;
    updateItem(selectedProject.id, selectedItem.id, { tasks: [...selectedItem.tasks, { id: nextId("T"), text: newTaskText.trim(), done: false, employee: selectedItem.employee }] });
    setNewTaskText("");
  }

  function updateTask(taskId, patch) {
    if (!canEditSite || !selectedProject || !selectedItem) return;
    updateItem(selectedProject.id, selectedItem.id, {
      tasks: selectedItem.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    });
  }

  function addMaterial() {
    if (!canEditSite || !selectedProject || !selectedItem || !newMaterialText.trim()) return;
    updateItem(selectedProject.id, selectedItem.id, { materials: [...selectedItem.materials, { id: nextId("M"), text: newMaterialText.trim(), details: "", status: "Objednat", employee: selectedItem.employee }] });
    setNewMaterialText("");
  }

  function removeItem(itemId) {
    if (!canEditAll || !selectedProject) return;
    if (selectedProject.items.length <= 1) {
      alert("Zakázka musí mít alespoň jednu položku.");
      return;
    }
    if (!window.confirm("Opravdu smazat tuto položku zakázky?")) return;

    const remainingItems = selectedProject.items.filter((item) => item.id !== itemId);
    setProjects((prev) =>
      prev.map((project) =>
        project.id === selectedProject.id ? { ...project, items: remainingItems } : project
      )
    );

    if (selectedItemId === itemId) {
      setSelectedItemId(remainingItems[0]?.id);
    }
  }

  function addEmployee() {
    if (!canEditAll || !employeeName.trim()) return;
    const name = employeeName.trim();
    setEmployees((prev) => [...prev, name]);
    setEmployeeAbsences((prev) => ({ ...prev, [name]: prev[name] || [] }));
    setEmployeeName("");
  }

  function renameEmployeeAtIndex(index, newName) {
    if (!canEditAll) return;
    const oldName = employees[index];
    setEmployees((prev) => prev.map((employee, i) => (i === index ? newName : employee)));
    setEmployeeAbsences((prev) => {
      const next = { ...prev };
      if (oldName && oldName !== newName) {
        next[newName] = next[oldName] || [];
        delete next[oldName];
      }
      return next;
    });
    setProjects((prev) =>
      prev.map((project) => ({
        ...project,
        items: project.items.map((item) => ({
          ...item,
          employee: item.employee === oldName ? newName : item.employee,
          tasks: item.tasks.map((task) => ({ ...task, employee: task.employee === oldName ? newName : task.employee })),
          materials: item.materials.map((material) => ({ ...material, employee: material.employee === oldName ? newName : material.employee })),
        })),
      }))
    );
  }

  function removeEmployee(employee) {
    if (!canEditAll) return;
    const used = projects.some((project) => project.items.some((item) => item.employee === employee || item.tasks.some((task) => task.employee === employee) || item.materials.some((material) => material.employee === employee)));
    if (used) return alert("Tento zaměstnanec je někde přiřazený.");
    setEmployees((prev) => prev.filter((item) => item !== employee));
    setEmployeeAbsences((prev) => {
      const next = { ...prev };
      delete next[employee];
      return next;
    });
  }

  function addAbsence(employee) {
    if (!canEditAll) return;
    const absence = { id: nextId("ABS"), title: "Dovolená", startDate: todayString(), endDate: todayString() };
    setEmployeeAbsences((prev) => ({ ...prev, [employee]: [...(prev[employee] || []), absence] }));
  }

  function updateAbsence(employee, absenceId, patch) {
    if (!canEditAll) return;
    setEmployeeAbsences((prev) => ({
      ...prev,
      [employee]: (prev[employee] || []).map((absence) => (absence.id === absenceId ? { ...absence, ...patch } : absence)),
    }));
  }

  function removeAbsence(employee, absenceId) {
    if (!canEditAll) return;
    setEmployeeAbsences((prev) => ({
      ...prev,
      [employee]: (prev[employee] || []).filter((absence) => absence.id !== absenceId),
    }));
  }

  function toggleTask(taskId) {
    if (!canEditSite || !selectedProject || !selectedItem) return;
    updateItem(selectedProject.id, selectedItem.id, { tasks: selectedItem.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)) });
  }

  function updateMaterial(materialId, patch) {
    if (!canEditSite || !selectedProject || !selectedItem) return;
    updateItem(selectedProject.id, selectedItem.id, { materials: selectedItem.materials.map((material) => (material.id === materialId ? { ...material, ...patch } : material)) });
  }

  function resetLocalData() {
    if (!canEditAll) return;
    if (!window.confirm("Opravdu smazat uložená data v tomto prohlížeči?")) return;
    window.localStorage.removeItem(STORAGE_KEY);
    setEmployees(initialEmployees);
    setEmployeeAbsences({});
    setProjects(initialProjects);
    setSelectedProjectId(initialProjects[0].id);
    setSelectedItemId(initialProjects[0].items[0].id);
  }

  function loginAdmin() {
    if (password === ADMIN_PASSWORD) {
      setUserRole("admin");
      setPassword("");
    } else if (password === SITE_PASSWORD) {
      setUserRole("site");
      setPassword("");
    } else {
      alert("Špatné heslo.");
    }
  }

  function attendanceHours(record) {
    if (!record.arrival || !record.departure) return "—";
    const start = new Date(record.arrival);
    const end = new Date(record.departure);
    const minutes = Math.max(0, Math.round((end - start) / 60000) - 30);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours} h ${rest} min`;
  }

  function startAttendance() {
    if (!canEditSite || !attendanceEmployee || !attendanceProjectId) return;
    const alreadyOpen = attendanceRecords.some((record) => record.employee === attendanceEmployee && !record.departure);
    if (alreadyOpen) {
      alert("Tento zaměstnanec už má otevřený příchod bez odchodu.");
      return;
    }

    setAttendanceRecords((prev) => [
      {
        id: nextId("ATT"),
        employee: attendanceEmployee,
        projectId: attendanceProjectId,
        projectName: projects.find((project) => project.id === attendanceProjectId)?.name || "",
        arrival: new Date().toISOString(),
        departure: "",
        lunchMinutes: 30,
      },
      ...prev,
    ]);
  }

  function stopAttendance() {
    if (!canEditSite || !attendanceEmployee) return;
    const openRecord = attendanceRecords.find((record) => record.employee === attendanceEmployee && !record.departure);
    if (!openRecord) {
      alert("Tento zaměstnanec nemá otevřený příchod.");
      return;
    }

    setAttendanceRecords((prev) =>
      prev.map((record) =>
        record.id === openRecord.id ? { ...record, departure: new Date().toISOString(), lunchMinutes: 30 } : record
      )
    );
  }

  function formatDateTime(value) {
    if (!value) return "—";
    return new Date(value).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
  }

  function attendanceMinutes(record) {
    if (!record.arrival || !record.departure) return 0;
    const start = new Date(record.arrival);
    const end = new Date(record.departure);
    return Math.max(0, Math.round((end - start) / 60000) - (record.lunchMinutes || 30));
  }

  function formatMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours} h ${rest} min`;
  }

  const attendanceReport = useMemo(() => {
    const records = attendanceRecords.filter((record) => (record.arrival || "").slice(0, 7) === attendanceMonth);

    const byEmployee = employees.map((employee) => {
      const employeeRecords = records.filter((record) => record.employee === employee);
      const minutes = employeeRecords.reduce((sum, record) => sum + attendanceMinutes(record), 0);
      return { employee, records: employeeRecords.length, minutes };
    }).filter((row) => row.records > 0 || row.minutes > 0);

    const byProject = projects.map((project) => {
      const projectRecords = records.filter((record) => record.projectId === project.id);
      const minutes = projectRecords.reduce((sum, record) => sum + attendanceMinutes(record), 0);
      const people = [...new Set(projectRecords.map((record) => record.employee))];
      return { projectId: project.id, projectName: project.name, records: projectRecords.length, minutes, people };
    }).filter((row) => row.records > 0 || row.minutes > 0);

    const totalMinutes = records.reduce((sum, record) => sum + attendanceMinutes(record), 0);

    return { records, byEmployee, byProject, totalMinutes };
  }, [attendanceRecords, attendanceMonth, employees, projects]);

  function exportAttendanceCsv() {
    const header = ["Datum", "Zaměstnanec", "Zakázka", "Příchod", "Odchod", "Pauza min", "Odpracováno min", "Odpracováno"];
    const rows = attendanceReport.records.map((record) => [
      record.arrival ? new Date(record.arrival).toLocaleDateString("cs-CZ") : "",
      record.employee,
      record.projectName,
      record.arrival ? new Date(record.arrival).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }) : "",
      record.departure ? new Date(record.departure).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }) : "",
      record.lunchMinutes || 30,
      attendanceMinutes(record),
      formatMinutes(attendanceMinutes(record)),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dochazka-${attendanceMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportData() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      employees,
      employeeAbsences,
      projects,
      selectedProjectId,
      selectedItemId,
      viewYear,
      attendanceRecords,
      attendanceEmployee,
      attendanceProjectId,
      attendanceMonth,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `planovac-zakazek-zaloha-${todayString()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (!Array.isArray(imported.projects) || !Array.isArray(imported.employees)) {
          alert("Soubor nevypadá jako záloha plánovače zakázek.");
          return;
        }

        setEmployees(imported.employees || []);
        setEmployeeAbsences(imported.employeeAbsences || {});
        setProjects(
          imported.projects.map((project, index) => ({
            ...project,
            color: project.color || projectColors[index % projectColors.length],
          }))
        );
        setSelectedProjectId(imported.selectedProjectId || imported.projects?.[0]?.id);
        setSelectedItemId(imported.selectedItemId || imported.projects?.[0]?.items?.[0]?.id);
        setViewYear(imported.viewYear || new Date().getFullYear());
        setAttendanceRecords(imported.attendanceRecords || []);
        setAttendanceEmployee(imported.attendanceEmployee || imported.employees?.[0] || "");
        setAttendanceProjectId(imported.attendanceProjectId || imported.projects?.[0]?.id || "");
        setAttendanceMonth(imported.attendanceMonth || todayString().slice(0, 7));
        alert("Data byla úspěšně importována.");
      } catch (error) {
        alert("Import se nepovedl. Zkontrolujte, že nahráváte správný JSON soubor.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-2 text-slate-900 sm:p-4">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <div className="sticky top-2 z-20 flex flex-col gap-3 rounded-3xl bg-white/95 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Plánovač zakázek</h1>
            <p className="text-xs text-slate-500 sm:text-sm">Zakázky • položky • úkoly • materiál • zaměstnanci • týdenní kapacity</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <div className="rounded-2xl bg-slate-100 px-4 py-2"><b>{projects.length}</b> zakázek</div>
            <div className="rounded-2xl bg-slate-100 px-4 py-2"><b>{employees.length}</b> lidí</div>
            <div className="rounded-2xl bg-green-100 px-4 py-2 text-green-800">{saveStatus}</div>
            <div className={`rounded-2xl px-4 py-2 ${userRole === "admin" ? "bg-blue-100 text-blue-800" : userRole === "site" ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-500"}`}>
              {userRole === "admin" ? "Admin" : userRole === "site" ? "Stavba" : "Pouze náhled"}
            </div>
            {userRole === "viewer" ? (
              <div className="flex gap-2">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loginAdmin()} placeholder="Heslo" className="w-32 rounded-2xl border px-3 py-2 text-sm" />
                <Button className="rounded-2xl" onClick={loginAdmin}>Odemknout</Button>
              </div>
            ) : (
              <>
                <Button variant="outline" className="rounded-2xl" onClick={() => setUserRole("viewer")}>Zamknout</Button>
                {canEditAll && (
                  <>
                    <Button variant="outline" className="rounded-2xl" onClick={exportData}>Export dat</Button>
                    <Button variant="outline" className="rounded-2xl" onClick={() => fileInputRef.current?.click()}>Import dat</Button>
                    <input ref={fileInputRef} type="file" accept="application/json" onChange={importData} className="hidden" />
                    <Button variant="outline" className="rounded-2xl" onClick={resetLocalData}>Smazat data</Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <Card className="rounded-3xl shadow-sm">
          <CardContent className="p-4">
            <div className="mb-4 flex flex-col gap-1">
              <div className="text-lg font-bold">Dashboard firmy</div>
              <div className="text-sm text-slate-500">Rychlý přehled zakázek, materiálu a financí</div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase text-slate-500">Zakázky celkem</div>
                <div className="mt-2 text-3xl font-bold">{dashboard.totalProjects}</div>
                <div className="mt-2 text-sm text-slate-500">Aktivní: {dashboard.activeProjects} • Start do 30 dnů: {dashboard.upcomingProjects}</div>
              </div>

              <div className={`rounded-2xl border p-4 ${dashboard.overdueProjects > 0 ? "bg-red-50" : "bg-green-50"}`}>
                <div className="text-xs font-medium uppercase text-slate-500">Riziko termínu</div>
                <div className={`mt-2 text-3xl font-bold ${dashboard.overdueProjects > 0 ? "text-red-700" : "text-green-700"}`}>{dashboard.overdueProjects}</div>
                <div className="mt-2 text-sm text-slate-500">Zakázky po termínu bez dokončení</div>
              </div>

              <div className="rounded-2xl border bg-red-50 p-4">
                <div className="text-xs font-medium uppercase text-slate-500">Materiál objednat</div>
                <div className="mt-2 text-3xl font-bold text-red-700">{dashboard.materialByStatus["Objednat"] || 0}</div>
                <div className="mt-2 text-sm text-slate-500">Ve výrobě: {dashboard.materialByStatus["Ve výrobě"] || 0} • Na cestě: {dashboard.materialByStatus["Na cestě"] || 0}</div>
              </div>

              <div className="rounded-2xl border bg-blue-50 p-4">
                <div className="text-xs font-medium uppercase text-slate-500">Hotovo z úkolů</div>
                <div className="mt-2 text-3xl font-bold text-blue-700">{dashboard.taskProgress}%</div>
                <div className="mt-2 text-sm text-slate-500">{dashboard.doneTasks} / {dashboard.allTasks} úkolů</div>
              </div>
            </div>

            {canEditAll && (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 font-semibold">Materiál podle stavu</div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {materialStatuses.map((status) => (
                    <div key={status} className={`rounded-xl border px-3 py-2 text-sm font-medium ${materialStatusClass(status)}`}>
                      {status}: {dashboard.materialByStatus[status] || 0}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 font-semibold">Finance</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-100 p-3"><div className="text-xs text-slate-500">Částka dle SoD</div><div className="font-bold">{money(dashboard.finance.contract)}</div></div>
                  <div className="rounded-xl bg-slate-100 p-3"><div className="text-xs text-slate-500">Vyfakturováno</div><div className="font-bold">{money(dashboard.finance.invoiced)}</div></div>
                  <div className="rounded-xl bg-slate-100 p-3"><div className="text-xs text-slate-500">Materiál</div><div className="font-bold">{money(dashboard.finance.material)}</div></div>
                  <div className="rounded-xl bg-slate-100 p-3"><div className="text-xs text-slate-500">Zbývá fakturovat</div><div className="font-bold">{money(dashboard.finance.remaining)}</div></div>
                </div>
              </div>
            </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-sm">
          <CardContent className="p-4">
            <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2 font-semibold"><CalendarDays size={18} /> Přehled zakázek v roce</div>
                <div className="mt-1 text-xs text-slate-500">Celkové termíny zakázek po týdnech</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setViewYear((year) => year - 1)}>←</Button>
                <div className="rounded-xl border bg-white px-4 py-2 text-sm font-medium">{viewYear}</div>
                <Button variant="outline" className="rounded-xl" onClick={() => setViewYear((year) => year + 1)}>→</Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border bg-white">
              <div className="min-w-[1200px] p-3">
                <div className="grid grid-cols-[220px_repeat(53,minmax(16px,1fr))] gap-1 text-xs">
                  <div className="font-medium text-slate-500">Zakázka</div>
                  {weeks.map((week) => (
                    <div
                      key={week}
                      className={`text-center ${week === currentWeek ? "rounded bg-blue-600 font-bold text-white" : "text-slate-400"}`}
                    >
                      {week}
                    </div>
                  ))}
                  {projects.map((project) => (
                    <React.Fragment key={project.id}>
                      <div className="truncate rounded-xl bg-slate-50 px-2 py-1 font-medium">{project.name}</div>
                      {weeks.map((week) => (
                        <div
                          key={week}
                          className={`h-6 rounded border ${week === currentWeek ? "border-blue-700 border-2" : "border-transparent"} ${overlapsDateRange(project.startDate, project.endDate, week, viewYear) ? project.color || "bg-slate-800" : "bg-slate-100"}`}
                        />
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {canEditSite && (
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold"><Users size={18} /> Docházka</div>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                <select value={attendanceEmployee} onChange={(e) => setAttendanceEmployee(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm">
                  {employees.map((employee) => <option key={employee}>{employee}</option>)}
                </select>
                <select value={attendanceProjectId} onChange={(e) => setAttendanceProjectId(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm">
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
                <Button disabled={hasOpenAttendance} onClick={startAttendance} className="bg-green-700 hover:bg-green-800">Příchod</Button>
                <Button disabled={!hasOpenAttendance} onClick={stopAttendance} className="bg-red-700 hover:bg-red-800">Odchod</Button>
              </div>
              <div className="mt-3 text-xs text-slate-500">
                {hasOpenAttendance ? "Příchod je zapsaný – teď je možné zadat už jen odchod." : "Obědová pauza 30 minut se odečítá automaticky po zadání odchodu."}
              </div>

              {canEditAll && (
                <>
                  <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
                    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold">Měsíční výkaz docházky</div>
                        <div className="text-xs text-slate-500">Součty pro mzdy, zakázky a přehled kdo kde dělal</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="month"
                          value={attendanceMonth}
                          onChange={(e) => setAttendanceMonth(e.target.value)}
                          className="rounded-xl border bg-white px-3 py-2 text-sm"
                        />
                        <Button variant="outline" onClick={exportAttendanceCsv}>Export pro mzdy CSV</Button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-white p-4">
                        <div className="text-xs uppercase text-slate-500">Celkem hodin</div>
                        <div className="mt-1 text-2xl font-bold">{formatMinutes(attendanceReport.totalMinutes)}</div>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <div className="text-xs uppercase text-slate-500">Počet záznamů</div>
                        <div className="mt-1 text-2xl font-bold">{attendanceReport.records.length}</div>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <div className="text-xs uppercase text-slate-500">Zakázky s docházkou</div>
                        <div className="mt-1 text-2xl font-bold">{attendanceReport.byProject.length}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border bg-white p-4">
                        <div className="mb-3 font-semibold">Součet podle zaměstnanců</div>
                        <div className="space-y-2">
                          {attendanceReport.byEmployee.length === 0 && <div className="text-sm text-slate-500">Pro tento měsíc zatím nejsou záznamy.</div>}
                          {attendanceReport.byEmployee.map((row) => (
                            <div key={row.employee} className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm">
                              <span className="font-medium">{row.employee}</span>
                              <span>{formatMinutes(row.minutes)} • {row.records} záznamů</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-white p-4">
                        <div className="mb-3 font-semibold">Součet podle zakázek</div>
                        <div className="space-y-2">
                          {attendanceReport.byProject.length === 0 && <div className="text-sm text-slate-500">Pro tento měsíc zatím nejsou záznamy.</div>}
                          {attendanceReport.byProject.map((row) => (
                            <div key={row.projectId} className="rounded-xl bg-slate-100 px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">{row.projectName}</span>
                                <span>{formatMinutes(row.minutes)}</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">Dělali: {row.people.join(", ") || "—"}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-2xl border bg-white">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="p-2">Zaměstnanec</th>
                          <th className="p-2">Zakázka</th>
                          <th className="p-2">Příchod</th>
                          <th className="p-2">Odchod</th>
                          <th className="p-2">Pauza</th>
                          <th className="p-2">Čas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceReport.records.slice(0, 80).map((record) => (
                          <tr key={record.id} className="border-t">
                            <td className="p-2 font-medium">{record.employee}</td>
                            <td className="p-2">{record.projectName}</td>
                            <td className="p-2">{formatDateTime(record.arrival)}</td>
                            <td className="p-2">{formatDateTime(record.departure)}</td>
                            <td className="p-2">{record.lunchMinutes || 30} min</td>
                            <td className="p-2 font-medium">{attendanceHours(record)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="rounded-3xl shadow-sm">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold"><BriefcaseBusiness size={18} /> Zakázky</div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setSelectedItemId(project.items[0]?.id);
                  }}
                  className={`rounded-2xl border p-3 text-left transition ${selectedProjectId === project.id ? "border-slate-900 bg-slate-100" : "bg-white hover:bg-slate-50"}`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${project.color || "bg-slate-400"}`} />
                    <div className="font-medium">{project.name}</div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{dateRangeLabel(project.startDate, project.endDate)}</div>
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                disabled={!canEdit}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addProject()}
                placeholder="Nová zakázka"
                className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
              />
              <Button disabled={!canEdit} onClick={addProject} className="rounded-xl">
                <Plus size={16} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {selectedProject && (
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-500">Název zakázky</label>
                  <input disabled={!canEdit} value={selectedProject.name} onChange={(e) => updateProject(selectedProject.id, { name: e.target.value })} className="w-full rounded-xl border px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Datum od</label>
                  <input disabled={!canEdit} type="date" value={selectedProject.startDate || todayString()} onChange={(e) => updateProject(selectedProject.id, { startDate: e.target.value })} className="w-full rounded-xl border px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Datum do</label>
                  <input disabled={!canEdit} type="date" value={selectedProject.endDate || todayString()} onChange={(e) => updateProject(selectedProject.id, { endDate: e.target.value })} className="w-full rounded-xl border px-3 py-2" />
                </div>
                {canEdit && [
                  ["Částka dle SoD", "contractAmount"],
                  ["Částka za materiál", "materialAmount"],
                  ["Částka za práci", "workAmount"],
                  ["Dílčí fakturace", "invoicedAmount"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
                    <input value={selectedProject[key] || ""} onChange={(e) => updateProject(selectedProject.id, { [key]: e.target.value })} placeholder="0 Kč" className="w-full rounded-xl border px-3 py-2" />
                  </div>
                ))}
              </div>
              <textarea disabled={!canEdit} value={selectedProject.note || ""} onChange={(e) => updateProject(selectedProject.id, { note: e.target.value })} placeholder="Poznámka k zakázce" className="mt-3 w-full rounded-xl border px-3 py-2 text-sm" />
            </CardContent>
          </Card>
        )}

        <Card className="rounded-3xl shadow-sm">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold"><Hammer size={18} /> Položky zakázky</div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {selectedProject?.items.map((item) => (
                <div key={item.id} className={`rounded-2xl border p-3 ${selectedItemId === item.id ? "border-slate-900 bg-slate-100" : "bg-white hover:bg-slate-50"}`}>
                  <button onClick={() => setSelectedItemId(item.id)} className="w-full text-left">
                    <div className="font-medium">{item.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{dateRangeLabel(item.startDate, item.endDate)} • {item.employee}</div>
                  </button>
                  {canEditAll && (
                    <button onClick={() => removeItem(item.id)} className="mt-2 rounded-xl bg-red-100 px-3 py-1 text-xs text-red-700 hover:bg-red-200">
                      Smazat položku
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                disabled={!canEdit}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
                placeholder="Nová položka zakázky"
                className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
              />
              <Button disabled={!canEdit} onClick={addItem} className="rounded-xl"><Plus size={16} /></Button>
            </div>
          </CardContent>
        </Card>

        {selectedItem && (
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-4">
              <div className="mb-3 font-semibold">Detail položky</div>
              <div className="grid gap-4 xl:grid-cols-[380px_1fr_1fr]">
                <div className="space-y-4 rounded-2xl border bg-slate-50 p-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Název položky</label>
                    <input disabled={!canEdit} value={selectedItem.name} onChange={(e) => updateItem(selectedProject.id, selectedItem.id, { name: e.target.value })} className="w-full rounded-xl border bg-white px-3 py-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Datum od</label>
                      <input disabled={!canEdit} type="date" value={selectedItem.startDate || todayString()} onChange={(e) => updateItem(selectedProject.id, selectedItem.id, { startDate: e.target.value })} className="w-full rounded-xl border bg-white px-3 py-2" />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Datum do</label>
                      <input disabled={!canEdit} type="date" value={selectedItem.endDate || todayString()} onChange={(e) => updateItem(selectedProject.id, selectedItem.id, { endDate: e.target.value })} className="w-full rounded-xl border bg-white px-3 py-2" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Zaměstnanec / parta</label>
                    <select disabled={!canEdit} value={selectedItem.employee} onChange={(e) => updateItem(selectedProject.id, selectedItem.id, { employee: e.target.value })} className="w-full rounded-xl border bg-white px-3 py-2">
                      {employees.map((employee) => <option key={employee}>{employee}</option>)}
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="mb-3 font-semibold">Úkoly k položce</div>
                  <div className="space-y-2">
                    {selectedItem.tasks.map((task) => (
                      <div key={task.id} className="grid gap-2 rounded-2xl border p-2 sm:grid-cols-[auto_1fr_180px] sm:items-center">
                        <button disabled={!canEditSite} onClick={() => toggleTask(task.id)}>
                          {task.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>
                        <div className={`text-sm ${task.done ? "line-through text-slate-400" : ""}`}>
                          {task.text}
                        </div>
                        <select
                          disabled={!canEditSite}
                          value={task.employee || selectedItem.employee || ""}
                          onChange={(e) => updateTask(task.id, { employee: e.target.value })}
                          className="rounded-xl border px-2 py-1 text-xs"
                        >
                          {employees.map((employee) => <option key={employee}>{employee}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input disabled={!canEditSite} value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="Nový úkol" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" />
                    <Button disabled={!canEditSite} onClick={addTask} className="rounded-xl"><Plus size={16} /></Button>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <div className="mb-3 font-semibold">Materiál k položce</div>
                  <div className="space-y-2">
                    {selectedItem.materials.map((material) => (
                      <div key={material.id} className="rounded-2xl border p-3">
                        <div className="font-medium text-sm">{material.text}</div>

                        <textarea disabled={!canEditSite} value={material.details || ""} onChange={(e) => updateMaterial(material.id, { details: e.target.value })} placeholder="Množství, barva, rozměr, poznámka…" className="mt-2 w-full rounded-xl border px-2 py-1 text-xs" rows={2} />

                        <div className="mt-2 flex flex-wrap gap-2">
                          <select disabled={!canEditSite} value={material.status} onChange={(e) => updateMaterial(material.id, { status: e.target.value })} className={`rounded-xl border px-2 py-1 text-xs font-medium ${materialStatusClass(material.status)}`}>
                            {materialStatuses.map((status) => <option key={status}>{status}</option>)}
                          </select>

                          <select disabled={!canEditSite} value={material.employee} onChange={(e) => updateMaterial(material.id, { employee: e.target.value })} className="rounded-xl border px-2 py-1 text-xs">
                            {employees.map((employee) => <option key={employee}>{employee}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <input disabled={!canEditSite} value={newMaterialText} onChange={(e) => setNewMaterialText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMaterial()} placeholder="Nový materiál" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" />
                    <Button disabled={!canEditSite} onClick={addMaterial} className="rounded-xl"><Plus size={16} /></Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {canEdit && (
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-4">
              <button
                type="button"
                onClick={() => setEmployeesOpen((open) => !open)}
                className="mb-0 flex w-full items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-left font-semibold transition hover:bg-slate-200"
              >
                <span className="flex items-center gap-2"><Users size={18} /> Zaměstnanci</span>
                <span className="text-sm text-slate-500">{employees.length} lidí • {employeesOpen ? "skrýt" : "rozbalit"}</span>
              </button>

              {employeesOpen && (
                <>
                  <div className="mt-3 space-y-3">
                {employees.map((employee, index) => (
                  <div key={index} className="rounded-2xl bg-slate-100 p-3">
                    <div className="flex items-center gap-2">
                      <input value={employee} onChange={(e) => renameEmployeeAtIndex(index, e.target.value)} className="min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 text-sm" />
                      <button onClick={() => removeEmployee(employee)} className="rounded-xl bg-red-100 p-2 text-red-600"><Trash2 size={16} /></button>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="text-xs font-medium text-slate-500">Nepřítomnost / kalendář zaměstnance</div>
                      {(employeeAbsences[employee] || []).map((absence) => (
                        <div key={absence.id} className="grid gap-2 rounded-xl bg-white p-2 sm:grid-cols-[1fr_150px_150px_auto]">
                          <input value={absence.title || ""} onChange={(e) => updateAbsence(employee, absence.id, { title: e.target.value })} placeholder="Dovolená, lékař, školení…" className="rounded-xl border px-3 py-2 text-sm" />
                          <input type="date" value={absence.startDate || todayString()} onChange={(e) => updateAbsence(employee, absence.id, { startDate: e.target.value })} className="rounded-xl border px-3 py-2 text-sm" />
                          <input type="date" value={absence.endDate || todayString()} onChange={(e) => updateAbsence(employee, absence.id, { endDate: e.target.value })} className="rounded-xl border px-3 py-2 text-sm" />
                          <button onClick={() => removeAbsence(employee, absence.id)} className="rounded-xl bg-red-100 p-2 text-red-600"><Trash2 size={16} /></button>
                        </div>
                      ))}
                      <Button variant="outline" onClick={() => addAbsence(employee)} className="rounded-xl text-xs">+ Přidat dovolenou / lékaře</Button>
                    </div>
                  </div>
                ))}
              </div>
                  <div className="mt-3 flex gap-2">
                    <input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEmployee()} placeholder="Přidat jméno" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm" />
                    <Button onClick={addEmployee} className="rounded-xl"><Plus size={16} /></Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {canEdit && (
          <Card className="rounded-3xl shadow-sm">
            <CardContent className="p-4">
              <button
                type="button"
                onClick={() => setWorkloadOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-left font-semibold transition hover:bg-slate-200"
              >
                <span className="flex items-center gap-2"><Users size={18} /> Vytíženost zaměstnanců – {viewYear}</span>
                <span className="text-sm text-slate-500">{workloadOpen ? "skrýt" : "rozbalit"}</span>
              </button>

              {workloadOpen && (
                <>
                  <div className="mb-3 mt-3 text-xs text-slate-500">Číslo = počet položek v týdnu, X = dovolená/lékař/nepřítomnost.</div>
                  <div className="mb-4 space-y-2 md:hidden">
                {employees.map((employee) => {
                  const blockedCount = (blockedWeeks[employee] || []).filter(Boolean).length;
                  return <div key={employee} className="rounded-2xl border bg-white p-3"><div className="font-medium">{employee}</div><div className="mt-1 text-xs text-slate-500">Aktivní týdny: {(workload[employee] || []).filter(Boolean).length} • Blokované týdny: {blockedCount}</div></div>;
                })}
              </div>
              <div className="overflow-x-auto rounded-2xl border bg-white">
                <div className="min-w-[900px] p-3">
                  <div className="grid grid-cols-[120px_repeat(53,minmax(16px,1fr))] gap-1 text-xs">
                    <div className="font-medium text-slate-500">Člověk</div>
                    {weeks.map((week) => <div key={week} className="text-center text-slate-400">{week}</div>)}
                    {employees.map((employee) => (
                      <React.Fragment key={employee}>
                        <div className="truncate font-medium">{employee}</div>
                        {weeks.map((week) => {
                          const value = workload[employee]?.[week - 1] || 0;
                          const blocked = blockedWeeks[employee]?.[week - 1];
                          return <div key={week} className={`h-5 rounded text-center leading-5 ${blocked ? "bg-red-700 text-white" : value === 0 ? "bg-slate-100 text-slate-300" : value === 1 ? "bg-green-200" : value === 2 ? "bg-yellow-200" : "bg-red-300"}`}>{blocked ? "X" : value || ""}</div>;
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
