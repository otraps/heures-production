// Constants
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 3;
const COMPENSATION_START_HOUR = 22;
const COMPENSATION_END_HOUR = 5;
const COMPENSATION_RATE = 0.1; // 6 minutes par heure = 0.1 heure
const HOURS_PER_MONTH = 182; // Objectif d'heures par mois
const HOURS_PER_DAY = 8; // Heures par jour de travail

// État global
let timeEntries = [];
let employees = [];
let absences = [];
let recurringAbsences = []; // Nouveau tableau pour les congés récurrents
let currentEntryId = null;
let selectedEmployee = '';
let lastBreakTime = 30; // Stockage du dernier temps de pause utilisé
let lastStartTime = ''; // Stockage de la dernière heure de début utilisée

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    
    // Initialiser le champ de pause avec la dernière valeur
    const savedBreakTime = localStorage.getItem('lastBreakTime');
    if (savedBreakTime) {
        const breakTimeInput = document.getElementById('breakTime');
        if (breakTimeInput) {
            lastBreakTime = parseInt(savedBreakTime);
            breakTimeInput.value = lastBreakTime;
        }
    }
});

// Fonction d'initialisation principale
function initializeApp() {
    try {
        loadData();
        setupEventListeners();
        updateDisplay();
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
    }
}

// Configuration des écouteurs d'événements
function setupEventListeners() {
    const elements = {
        timeForm: document.getElementById('timeForm'),
        monthSelect: document.getElementById('monthSelect'),
        exportBtn: document.getElementById('exportBtn'),
        confirmDelete: document.getElementById('confirmDelete'),
        employeeSelect: document.getElementById('employeeSelect'),
        addEmployee: document.getElementById('addEmployee'),
        deleteEmployee: document.getElementById('deleteEmployee'),
        addAbsence: document.getElementById('addAbsence'),
        addRecurring: document.getElementById('addRecurring'),
        addQuickAbsence: document.getElementById('addQuickAbsence'),
        backupData: document.getElementById('backupData'),
        restoreDataBtn: document.getElementById('restoreDataBtn'),
        restoreData: document.getElementById('restoreData'),
        breakTime: document.getElementById('breakTime'),
        printTimesheet: document.getElementById('printTimesheet')
    };

    // Vérifier que tous les éléments existent
    for (const [key, element] of Object.entries(elements)) {
        if (!element) {
            console.warn(`Élément '${key}' non trouvé dans le DOM`);
            continue;
        }
    }

    // Ajouter les écouteurs d'événements seulement si les éléments existent
    if (elements.timeForm) elements.timeForm.addEventListener('submit', handleFormSubmit);
    if (elements.monthSelect) elements.monthSelect.addEventListener('change', updateMonthlyRecap);
    if (elements.exportBtn) elements.exportBtn.addEventListener('click', exportData);
    if (elements.confirmDelete) elements.confirmDelete.addEventListener('click', confirmDelete);
    if (elements.employeeSelect) elements.employeeSelect.addEventListener('change', handleEmployeeChange);
    if (elements.addEmployee) elements.addEmployee.addEventListener('click', handleAddEmployee);
    if (elements.deleteEmployee) elements.deleteEmployee.addEventListener('click', handleDeleteEmployee);
    if (elements.addAbsence) elements.addAbsence.addEventListener('click', handleAddAbsence);
    if (elements.addRecurring) elements.addRecurring.addEventListener('click', handleAddRecurringAbsence);
    if (elements.addQuickAbsence) elements.addQuickAbsence.addEventListener('click', handleQuickAddAbsence);
    if (elements.backupData) elements.backupData.addEventListener('click', backupData);
    if (elements.restoreDataBtn) {
        elements.restoreDataBtn.addEventListener('click', () => {
            if (elements.restoreData) elements.restoreData.click();
        });
    }
    if (elements.restoreData) elements.restoreData.addEventListener('change', restoreData);
    if (elements.breakTime) elements.breakTime.addEventListener('input', (e) => {
        lastBreakTime = parseInt(e.target.value) || 30;
        localStorage.setItem('lastBreakTime', lastBreakTime.toString());
    });
    if (elements.printTimesheet) elements.printTimesheet.addEventListener('click', printTimesheet);

    // Sauvegarder la dernière heure de début quand elle est modifiée
    document.getElementById('startTime').addEventListener('change', (e) => {
        lastStartTime = e.target.value;
        localStorage.setItem('lastStartTime', lastStartTime);
    });

    // Charger la dernière heure de début au chargement du formulaire
    const savedStartTime = localStorage.getItem('lastStartTime');
    if (savedStartTime) {
        document.getElementById('startTime').value = savedStartTime;
    }
}

// Gestion des employés
function handleEmployeeChange(e) {
    selectedEmployee = e.target.value;
    updateDisplay();
    updateAbsencesList();
    updateMonthlyRecap();
    updateHistoryTable();
}

function handleAddEmployee() {
    const input = document.getElementById('newEmployee');
    const newEmployeeName = input.value.trim();
    
    if (!newEmployeeName) {
        alert('Veuillez entrer un nom d\'employé');
        return;
    }
    
    // Vérifier si l'employé existe déjà (insensible à la casse)
    const exists = employees.some(emp => emp.toLowerCase() === newEmployeeName.toLowerCase());
    if (exists) {
        alert('Cet employé existe déjà');
        return;
    }

    // Ajouter et sauvegarder
    employees.push(newEmployeeName);
    saveEmployees();
    
    // Mettre à jour l'interface
    input.value = '';
    updateEmployeeSelect();
    
    // Sélectionner le nouvel employé
    const select = document.getElementById('employeeSelect');
    select.value = newEmployeeName;
    selectedEmployee = newEmployeeName;
    
    updateDisplay();
    updateAbsencesList();
}

function handleDeleteEmployee() {
    const employee = document.getElementById('employeeSelect').value;
    if (!employee) {
        alert('Veuillez sélectionner un employé à supprimer');
        return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'employé "${employee}" ?\nCette action supprimera également toutes ses entrées de temps et ses absences.`)) {
        return;
    }

    // Supprimer l'employé
    employees = employees.filter(emp => emp !== employee);
    saveEmployees();

    // Supprimer ses entrées
    timeEntries = timeEntries.filter(entry => entry.employee !== employee);
    saveData();

    // Supprimer ses absences
    absences = absences.filter(absence => absence.employee !== employee);
    saveAbsences();

    // Supprimer ses congés récurrents
    recurringAbsences = recurringAbsences.filter(absence => absence.employee !== employee);
    saveRecurringAbsences();

    // Mettre à jour l'interface
    selectedEmployee = '';
    updateEmployeeSelect();
    updateDisplay();
    updateAbsencesList();
}

function updateEmployeeSelect() {
    const select = document.getElementById('employeeSelect');
    const currentSelection = select.value;
    
    // Vider la liste
    select.innerHTML = '<option value="">Tous les employés</option>';
    
    // Ajouter les employés triés
    [...employees]
        .sort((a, b) => a.localeCompare(b))
        .forEach(emp => {
            const option = document.createElement('option');
            option.value = emp;
            option.textContent = emp;
            select.appendChild(option);
        });
    
    // Restaurer la sélection
    if (currentSelection && employees.includes(currentSelection)) {
        select.value = currentSelection;
    }
}

// Gestion du formulaire
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const employee = document.getElementById('employeeSelect').value;
    if (!employee) {
        alert('Veuillez sélectionner un employé');
        return;
    }

    const date = document.getElementById('workDate').value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const breakMinutes = parseInt(document.getElementById('breakTime').value);

    if (!date || !startTime || !endTime) {
        alert('Veuillez remplir tous les champs');
        return;
    }

    const hours = calculateHours(date, startTime, endTime, breakMinutes);
    
    const entry = {
        id: currentEntryId || Date.now(),
        employee,
        date,
        startTime,
        endTime,
        breakMinutes,
        ...hours
    };

    if (currentEntryId) {
        timeEntries = timeEntries.map(e => e.id === currentEntryId ? entry : e);
        currentEntryId = null;
    } else {
        timeEntries.push(entry);
    }

    saveData();
    
    // Réinitialiser le formulaire sauf la date et le temps de pause
    document.getElementById('startTime').value = lastStartTime;
    document.getElementById('endTime').value = '';
    document.getElementById('breakTime').value = lastBreakTime;
    
    // Mettre à jour la date au jour suivant
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    document.getElementById('workDate').value = nextDay.toISOString().split('T')[0];
    
    updateDisplay();
}

// Calcul des heures
function calculateHours(date, startTime, endTime, breakMinutes) {
    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    
    // Ajuster si l'heure de fin est le jour suivant
    if (end < start) {
        end.setDate(end.getDate() + 1);
    }

    let normalHours = 0;
    let nightHours = 0;
    let compensationHours = 0;
    let currentTime = new Date(start);

    // Soustraire la pause du temps total
    const totalMinutes = (end - start) / (1000 * 60) - breakMinutes;
    if (totalMinutes <= 0) return null;

    while (currentTime < end) {
        const hour = currentTime.getHours();
        const isNightHour = (hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR);
        const isCompensationHour = (hour >= COMPENSATION_START_HOUR || hour < COMPENSATION_END_HOUR);
        
        // Calculer le temps jusqu'à la prochaine heure ou la fin
        const nextHour = new Date(currentTime);
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        const timeToAdd = Math.min(1, (end - currentTime) / (1000 * 60 * 60));

        if (isNightHour) {
            nightHours += timeToAdd;
        } else {
            normalHours += timeToAdd;
        }

        if (isCompensationHour) {
            compensationHours += timeToAdd;
        }

        currentTime = nextHour;
    }

    // Appliquer la pause proportionnellement
    const pauseRatio = breakMinutes / (60 * (normalHours + nightHours));
    normalHours *= (1 - pauseRatio);
    nightHours *= (1 - pauseRatio);
    compensationHours *= (1 - pauseRatio);

    // Calculer la compensation (6 minutes par heure = 0.1 heure)
    const compensationBonus = compensationHours * COMPENSATION_RATE;
    const totalHours = normalHours + nightHours + compensationBonus;

    return {
        normalHours,
        nightHours,
        compensationHours: compensationBonus,
        totalHours
    };
}

// Formatage des heures
function formatHours(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m.toString().padStart(2, '0')}`;
}

function formatBalance(hours) {
    const sign = hours >= 0 ? '+' : '';
    return `${sign}${formatHours(hours)}`;
}

// Mise à jour de l'affichage
function updateDisplay() {
    try {
        // Mettre à jour la sélection d'employé d'abord
        updateEmployeeSelect();
        
        // Mettre à jour les affichages principaux
        updateHistoryTable();
        updateMonthlyRecap();
        updateAbsencesList();
        
        // Restaurer le temps de pause
        const breakTimeInput = document.getElementById('breakTime');
        if (breakTimeInput) {
            const savedBreakTime = localStorage.getItem('lastBreakTime');
            if (savedBreakTime) {
                lastBreakTime = parseInt(savedBreakTime);
                breakTimeInput.value = lastBreakTime;
            } else {
                // Valeur par défaut si rien n'est sauvegardé
                breakTimeInput.value = lastBreakTime;
            }
        }
        
        // Restaurer la dernière heure de début
        const startTimeInput = document.getElementById('startTime');
        if (startTimeInput) {
            const savedStartTime = localStorage.getItem('lastStartTime');
            if (savedStartTime) {
                lastStartTime = savedStartTime;
                startTimeInput.value = lastStartTime;
            }
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'affichage:', error.message);
    }
}

// Mise à jour du tableau d'historique
function updateHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) {
        console.warn('Table d\'historique non trouvée');
        return;
    }

    try {
        tbody.innerHTML = '';

        // Filtrer les entrées pour l'employé sélectionné
        let filteredEntries = [...timeEntries];
        if (selectedEmployee) {
            filteredEntries = filteredEntries.filter(entry => entry.employee === selectedEmployee);
        }

        // Trier par date décroissante
        filteredEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

        filteredEntries.forEach(entry => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDate(entry.date)}</td>
                <td>${entry.employee}</td>
                <td>${entry.startTime}</td>
                <td>${entry.endTime}</td>
                <td>${entry.breakMinutes}</td>
                <td>${formatHours(entry.normalHours)}</td>
                <td>${formatHours(entry.nightHours)}</td>
                <td>${formatHours(entry.compensationHours)}</td>
                <td>${formatHours(entry.totalHours)}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteEntry(${entry.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du tableau d\'historique:', error);
    }
}

// Mise à jour du récapitulatif mensuel
function updateMonthlyRecap() {
    const monthSelect = document.getElementById('monthSelect');
    const [year, month] = monthSelect.value.split('-');
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    // Filtrer les entrées du mois
    const monthEntries = timeEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        const isInMonth = entryDate >= monthStart && entryDate <= monthEnd;
        return selectedEmployee ? (isInMonth && entry.employee === selectedEmployee) : isInMonth;
    });

    // Calculer les totaux
    const totals = {
        normalHours: 0,
        nightHours: 0,
        compHours: 0,
        totalHours: 0
    };

    monthEntries.forEach(entry => {
        totals.normalHours += entry.normalHours || 0;
        totals.nightHours += entry.nightHours || 0;
        totals.compHours += entry.compensationHours || 0;
        totals.totalHours += entry.totalHours || 0;
    });

    // Mettre à jour l'affichage des heures
    document.getElementById('monthNormalHours').textContent = formatHours(totals.normalHours);
    document.getElementById('monthNightHours').textContent = formatHours(totals.nightHours);
    document.getElementById('monthCompHours').textContent = formatHours(totals.compHours);
    document.getElementById('monthTotalHours').textContent = formatHours(totals.totalHours);
    document.getElementById('monthBalance').textContent = formatBalance(totals.totalHours - HOURS_PER_MONTH);

    // Calculer les absences
    const monthAbsences = getMonthAbsences(monthStart, monthEnd)
        .filter(absence => !selectedEmployee || absence.employee === selectedEmployee);

    const absenceTotals = {
        holiday: 0,    // Férié
        vacation: 0,   // Vacance
        leave: 0,      // Congé
        sick: 0,       // Maladie
        total: 0
    };

    monthAbsences.forEach(absence => {
        const days = calculateWorkingDays(new Date(absence.startDate), new Date(absence.endDate));
        absenceTotals[absence.type] = (absenceTotals[absence.type] || 0) + days;
        absenceTotals.total += days;
    });

    // Mettre à jour l'affichage des absences
    document.getElementById('monthHolidays').textContent = `${absenceTotals.holiday} jours`;
    document.getElementById('monthVacationDays').textContent = `${absenceTotals.vacation} jours`;
    document.getElementById('monthUnpaidDays').textContent = `${absenceTotals.leave} jours`;
    document.getElementById('monthSickDays').textContent = `${absenceTotals.sick} jours`;
    document.getElementById('monthTotalAbsences').textContent = `${absenceTotals.total} jours`;
}

// Fonction d'impression
function printMonthlyRecap() {
    const employee = document.getElementById('employeeSelect').value;
    if (!employee) {
        alert('Veuillez sélectionner un employé pour imprimer son récapitulatif');
        return;
    }

    // Mettre à jour l'en-tête d'impression
    const monthSelect = document.getElementById('monthSelect');
    const [year, month] = monthSelect.value.split('-');
    const monthDate = new Date(year, month - 1);
    
    document.getElementById('printEmployeeName').textContent = `Employé: ${employee}`;
    document.getElementById('printPeriod').textContent = 
        `Période: ${monthDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`;

    // Préparer les données pour l'impression
    prepareDataForPrint();

    // Lancer l'impression
    window.print();
}

function prepareDataForPrint() {
    // Ajouter une signature en bas de page
    const footer = document.createElement('div');
    footer.className = 'print-footer print-only';
    footer.innerHTML = `
        <div class="row mt-5">
            <div class="col-6">
                <p>Signature de l'employé:</p>
                <div style="border-top: 1px solid #000; margin-top: 3em;"></div>
            </div>
            <div class="col-6">
                <p>Signature du responsable:</p>
                <div style="border-top: 1px solid #000; margin-top: 3em;"></div>
            </div>
        </div>
        <div class="row mt-3">
            <div class="col-12 text-center">
                <small>Document généré le ${new Date().toLocaleDateString('fr-FR')}</small>
            </div>
        </div>
    `;
    
    // Ajouter le footer s'il n'existe pas déjà
    if (!document.querySelector('.print-footer')) {
        document.body.appendChild(footer);
    }

    // Cacher les éléments non nécessaires pour l'impression
    document.querySelectorAll('.no-print').forEach(el => {
        el.style.display = 'none';
    });

    // Afficher les éléments d'impression
    document.querySelectorAll('.print-only').forEach(el => {
        el.style.display = 'block';
    });
}

// Restaurer l'affichage après l'impression
window.onafterprint = function() {
    // Restaurer les éléments cachés
    document.querySelectorAll('.no-print').forEach(el => {
        el.style.display = '';
    });

    // Cacher les éléments d'impression
    document.querySelectorAll('.print-only').forEach(el => {
        el.style.display = 'none';
    });

    // Supprimer le footer d'impression
    const footer = document.querySelector('.print-footer');
    if (footer) {
        footer.remove();
    }
};

// Gestion des absences
function handleAddAbsence() {
    const employee = document.getElementById('employeeSelect').value;
    if (!employee) {
        alert('Veuillez sélectionner un employé');
        return;
    }

    const type = document.getElementById('absenceType').value;
    const startDate = document.getElementById('absenceStart').value;
    const endDate = document.getElementById('absenceEnd').value;

    if (!startDate || !endDate) {
        alert('Veuillez sélectionner les dates de début et de fin');
        return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
        alert('La date de fin doit être après la date de début');
        return;
    }

    // Calculer le nombre de jours ouvrés
    const days = calculateWorkingDays(startDate, endDate);

    // Créer l'absence
    const absence = {
        id: Date.now(),
        employee,
        type,
        startDate,
        endDate,
        days
    };

    // Ajouter et sauvegarder
    absences.push(absence);
    saveAbsences();

    // Mettre à jour l'interface
    updateAbsencesList();
    updateMonthlyRecap();

    // Réinitialiser les champs
    document.getElementById('absenceStart').value = '';
    document.getElementById('absenceEnd').value = '';
}

function calculateWorkingDays(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    let days = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        // Ne pas compter les weekends (0 = dimanche, 6 = samedi)
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
            days++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return days;
}

function updateAbsencesList() {
    const tbody = document.getElementById('absencesList');
    tbody.innerHTML = '';

    // Filtrer les absences pour l'employé sélectionné
    let filteredAbsences = [...absences];

    let filteredRecurring = [...recurringAbsences];
    
    if (selectedEmployee) {
        filteredAbsences = filteredAbsences.filter(a => a.employee === selectedEmployee);
        filteredRecurring = filteredRecurring.filter(a => a.employee === selectedEmployee);
    }

    // Afficher les absences ponctuelles
    filteredAbsences.forEach(absence => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${absence.employee}</td>
            <td>${getAbsenceTypeName(absence.type)}</td>
            <td>${formatDate(absence.startDate)}</td>
            <td>${formatDate(absence.endDate)}</td>
            <td>${absence.days} jour(s)</td>
            <td>Non</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteAbsence(${absence.id}, false)">
                    ❌
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Afficher les absences récurrentes
    filteredRecurring.forEach(recurring => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${recurring.employee}</td>
            <td>${getAbsenceTypeName(recurring.type)}</td>
            <td colspan="2">Tous les ${getDayName(recurring.dayOfWeek)}</td>
            <td>-</td>
            <td>Oui</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteAbsence(${recurring.id}, true)">
                    ❌
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getAbsenceTypeName(type) {
    const types = {
        holiday: 'Férié',
        vacation: 'Vacance',
        leave: 'Congé',
        sick: 'Maladie'
    };
    return types[type] || type;
}

function deleteAbsence(id, isRecurring) {
    if (!confirm('Voulez-vous vraiment supprimer cette absence ?')) {
        return;
    }

    if (isRecurring) {
        recurringAbsences = recurringAbsences.filter(a => a.id !== id);
        saveRecurringAbsences();
    } else {
        absences = absences.filter(a => a.id !== id);
        saveAbsences();
    }

    updateAbsencesList();
    updateMonthlyRecap();
}

function handleAddRecurringAbsence() {
    const employee = document.getElementById('employeeSelect').value;
    if (!employee) {
        alert('Veuillez sélectionner un employé');
        return;
    }

    const dayOfWeek = parseInt(document.getElementById('recurringDay').value);
    const type = document.getElementById('recurringType').value;

    // Vérifier si un congé récurrent existe déjà pour ce jour
    const exists = recurringAbsences.some(
        absence => absence.employee === employee && absence.dayOfWeek === dayOfWeek
    );

    if (exists) {
        alert('Un congé récurrent existe déjà pour ce jour');
        return;
    }

    // Ajouter le congé récurrent
    const recurring = {
        id: Date.now(),
        employee,
        dayOfWeek,
        type
    };

    recurringAbsences.push(recurring);
    saveRecurringAbsences();

    updateAbsencesList();
    updateMonthlyRecap();
}

function handleQuickAddAbsence() {
    const employee = document.getElementById('employeeSelect').value;
    if (!employee) {
        alert('Veuillez sélectionner un employé');
        return;
    }

    const date = document.getElementById('quickDate').value;
    const type = document.getElementById('quickType').value;

    if (!date) {
        alert('Veuillez sélectionner une date');
        return;
    }

    // Créer l'absence d'un jour
    const absence = {
        id: Date.now(),
        employee,
        type,
        startDate: date,
        endDate: date,
        days: 1
    };

    absences.push(absence);
    saveAbsences();

    // Réinitialiser le champ
    document.getElementById('quickDate').value = '';

    updateAbsencesList();
    updateMonthlyRecap();
}

function getDayName(dayOfWeek) {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[dayOfWeek];
}

// Exportation des données
function exportData() {
    const headers = [
        "Date", "Employé", "Début", "Fin", "Pause",
        "Heures normales", "Heures de nuit", "Compensation", "Total"
    ];

    const csvContent = [
        headers.join(';'),
        ...timeEntries.map(entry => [
            entry.date,
            entry.employee,
            entry.startTime,
            entry.endTime,
            entry.breakMinutes,
            formatHours(entry.normalHours),
            formatHours(entry.nightHours),
            formatHours(entry.compensationHours),
            formatHours(entry.totalHours)
        ].join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `heures_production_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
}

// Suppression d'une entrée
function deleteEntry(id) {
    try {
        currentEntryId = id;
        const modal = document.getElementById('deleteModal');
        if (!modal) {
            console.warn('Modal de suppression non trouvé');
            if (confirm('Voulez-vous vraiment supprimer cette entrée ?')) {
                confirmDelete();
            }
            return;
        }
        
        const deleteModal = new bootstrap.Modal(modal);
        deleteModal.show();
    } catch (error) {
        console.error('Erreur lors de la suppression:', error.message);
        if (confirm('Voulez-vous vraiment supprimer cette entrée ?')) {
            confirmDelete();
        }
    }
}

// Confirmation de la suppression
function confirmDelete() {
    try {
        if (!currentEntryId) {
            console.warn('Aucun ID d\'entrée à supprimer');
            return;
        }

        timeEntries = timeEntries.filter(entry => entry.id !== currentEntryId);
        saveData();
        updateDisplay();
        
        const modal = document.getElementById('deleteModal');
        if (modal) {
            const deleteModal = bootstrap.Modal.getInstance(modal);
            if (deleteModal) {
                deleteModal.hide();
            }
        }
        
        currentEntryId = null;
    } catch (error) {
        console.error('Erreur lors de la confirmation de suppression:', error.message);
    }
}

// Formatage de la date
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Sauvegarde des données
function backupData() {
    const data = {
        employees: employees,
        timeEntries: timeEntries,
        absences: absences,
        recurringAbsences: recurringAbsences,
        version: '1.0',
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `heures-production-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Restauration des données
function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Vérifier la structure des données
            if (!data.employees || !data.timeEntries || !data.absences || !data.recurringAbsences) {
                throw new Error('Format de fichier invalide');
            }

            // Confirmer la restauration
            if (!confirm('Êtes-vous sûr de vouloir restaurer les données ? Cela remplacera toutes les données actuelles.')) {
                return;
            }

            // Restaurer les données
            employees = data.employees;
            timeEntries = data.timeEntries;
            absences = data.absences;
            recurringAbsences = data.recurringAbsences;

            // Sauvegarder dans le localStorage
            saveEmployees();
            saveData();
            saveAbsences();
            saveRecurringAbsences();

            // Mettre à jour l'interface
            updateEmployeeSelect();
            updateDisplay();
            updateAbsencesList();
            updateMonthlyRecap();

            alert('Les données ont été restaurées avec succès !');
        } catch (error) {
            console.error('Erreur lors de la restauration des données:', error);
            alert('Erreur lors de la restauration des données. Vérifiez que le fichier est valide.');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Réinitialiser l'input file
}

// Persistance des données
function saveData() {
    localStorage.setItem('timeEntries', JSON.stringify(timeEntries));
}

function saveEmployees() {
    localStorage.setItem('employees', JSON.stringify(employees));
}

function saveAbsences() {
    localStorage.setItem('absences', JSON.stringify(absences));
}

function saveRecurringAbsences() {
    localStorage.setItem('recurringAbsences', JSON.stringify(recurringAbsences));
}

// Chargement des données
function loadData() {
    try {
        const savedTimeEntries = localStorage.getItem('timeEntries');
        const savedEmployees = localStorage.getItem('employees');
        const savedAbsences = localStorage.getItem('absences');
        const savedRecurring = localStorage.getItem('recurringAbsences');
        const savedBreakTime = localStorage.getItem('lastBreakTime');

        // Charger les données avec vérification de validité
        try {
            timeEntries = savedTimeEntries ? JSON.parse(savedTimeEntries) : [];
            employees = savedEmployees ? JSON.parse(savedEmployees) : [];
            absences = savedAbsences ? JSON.parse(savedAbsences) : [];
            recurringAbsences = savedRecurring ? JSON.parse(savedRecurring) : [];
            lastBreakTime = savedBreakTime ? parseInt(savedBreakTime) : 30;
            
            // Mettre à jour le champ de pause avec la valeur chargée
            const breakTimeInput = document.getElementById('breakTime');
            if (breakTimeInput) {
                breakTimeInput.value = lastBreakTime;
            }
        } catch (parseError) {
            console.error('Erreur lors du parsing des données:', parseError.message);
            employees = [];
            timeEntries = [];
            absences = [];
            recurringAbsences = [];
            lastBreakTime = 30;
        }

        // Vérifier l'intégrité des données
        if (!Array.isArray(employees)) employees = [];
        if (!Array.isArray(timeEntries)) timeEntries = [];
        if (!Array.isArray(absences)) absences = [];
        if (!Array.isArray(recurringAbsences)) recurringAbsences = [];
        if (isNaN(lastBreakTime)) lastBreakTime = 30;

        // Initialiser les dates
        const today = new Date();
        
        const monthSelect = document.getElementById('monthSelect');
        if (monthSelect) {
            monthSelect.value = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        
        const workDate = document.getElementById('workDate');
        if (workDate) {
            workDate.value = today.toISOString().split('T')[0];
        }
        
        ['absenceStart', 'absenceEnd', 'quickDate'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.value = today.toISOString().split('T')[0];
            }
        });

        // Sauvegarder uniquement si les données sont vides
        if (!savedEmployees) saveEmployees();
        if (!savedTimeEntries) saveData();
        if (!savedAbsences) saveAbsences();
        if (!savedRecurring) saveRecurringAbsences();
        if (!savedBreakTime) localStorage.setItem('lastBreakTime', lastBreakTime.toString());
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error.message);
    }
}

// Fonction pour obtenir les absences d'un mois
function getMonthAbsences(monthStart, monthEnd) {
    let allAbsences = [...absences];

    // Ajouter les absences récurrentes
    recurringAbsences.forEach(recurring => {
        const currentDate = new Date(monthStart);
        while (currentDate <= monthEnd) {
            if (currentDate.getDay() === recurring.dayOfWeek) {
                allAbsences.push({
                    id: Date.now() + currentDate.getTime(),
                    employee: recurring.employee,
                    type: recurring.type,
                    startDate: currentDate.toISOString().split('T')[0],
                    endDate: currentDate.toISOString().split('T')[0],
                    days: 1
                });
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });

    return allAbsences.filter(absence => {
        const absenceStart = new Date(absence.startDate);
        const absenceEnd = new Date(absence.endDate);
        return absenceStart <= monthEnd && absenceEnd >= monthStart;
    });
}

// Impression de la feuille d'heures
function printTimesheet() {
    // Sauvegarder l'état actuel de la page
    const originalContent = document.body.innerHTML;

    // Créer le contenu pour l'impression
    const printContent = document.createElement('div');
    printContent.className = 'print-timesheet';

    // En-tête
    const header = document.createElement('div');
    header.className = 'print-header';
    header.innerHTML = `
        <h1>Feuille d'Heures de Production</h1>
        <div class="employee-info">
            <p>Employé: ${selectedEmployee || 'Tous les employés'}</p>
            <p>Période: ${document.getElementById('monthSelect').value}</p>
        </div>
    `;
    printContent.appendChild(header);

    // Obtenir les entrées du mois et les absences
    const monthSelect = document.getElementById('monthSelect');
    const [year, month] = monthSelect.value.split('-');
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    
    // Récupérer et trier les entrées par date
    const monthEntries = getMonthEntries().sort((a, b) => {
        return new Date(a.date) - new Date(b.date);
    });

    // Récupérer et filtrer les absences
    const monthAbsences = getMonthAbsences(monthStart, monthEnd)
        .filter(absence => !selectedEmployee || absence.employee === selectedEmployee)
        .sort((a, b) => {
            return new Date(a.startDate) - new Date(b.startDate);
        });

    // Créer un tableau combiné des entrées et des absences
    let combinedEntries = [];

    // Ajouter les entrées avec leurs absences correspondantes
    monthEntries.forEach(entry => {
        const dateStr = entry.date;
        const absence = monthAbsences.find(abs => {
            const absStart = new Date(abs.startDate);
            const absEnd = new Date(abs.endDate);
            const entryDate = new Date(dateStr);
            return entryDate >= absStart && entryDate <= absEnd;
        });
        
        combinedEntries.push({
            type: 'entry',
            date: new Date(entry.date),
            data: entry,
            absence: absence
        });
    });

    // Ajouter les absences qui n'ont pas d'entrées correspondantes
    monthAbsences.forEach(absence => {
        const absStart = new Date(absence.startDate);
        const absEnd = new Date(absence.endDate);
        const hasNoEntry = !monthEntries.some(entry => {
            const entryDate = new Date(entry.date);
            return entryDate >= absStart && entryDate <= absEnd;
        });

        if (hasNoEntry) {
            // Pour les absences sur plusieurs jours, créer une entrée unique
            combinedEntries.push({
                type: 'absence',
                date: absStart,
                data: absence
            });
        }
    });

    // Trier toutes les entrées par date
    combinedEntries.sort((a, b) => a.date - b.date);

    // Générer le HTML du tableau
    const tableRows = combinedEntries.map(item => {
        if (item.type === 'entry') {
            const entry = item.data;
            return `
                <tr>
                    <td>${formatDate(entry.date)}</td>
                    <td>${entry.employee}</td>
                    <td>${entry.startTime}</td>
                    <td>${entry.endTime}</td>
                    <td>${entry.breakMinutes}min</td>
                    <td>${formatHours(entry.normalHours)}</td>
                    <td>${formatHours(entry.nightHours)}</td>
                    <td>${formatHours(entry.compensationHours)}</td>
                    <td>${formatHours(entry.totalHours)}</td>
                    <td>${item.absence ? getAbsenceTypeName(item.absence.type) : ''}</td>
                </tr>
            `;
        } else {
            const absence = item.data;
            return `
                <tr>
                    <td>${formatDate(absence.startDate)}${
                        absence.startDate !== absence.endDate 
                        ? ' - ' + formatDate(absence.endDate)
                        : ''
                    }</td>
                    <td>${absence.employee}</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>${getAbsenceTypeName(absence.type)}</td>
                </tr>
            `;
        }
    }).join('');

    // Créer le tableau
    const table = document.createElement('table');
    table.className = 'timesheet-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Date</th>
                <th>Employé</th>
                <th>Début</th>
                <th>Fin</th>
                <th>Pause</th>
                <th>H. Normales</th>
                <th>H. Nuit</th>
                <th>H. Comp.</th>
                <th>Total</th>
                <th>Absence</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    `;
    printContent.appendChild(table);

    // Pied de page avec totaux
    const totals = calculateMonthTotals(monthEntries);
    const footer = document.createElement('div');
    footer.className = 'print-footer';
    footer.innerHTML = `
        <div class="totals">
            <p><strong>Total Heures Normales:</strong> ${formatHours(totals.normalHours)}</p>
            <p><strong>Total Heures de Nuit:</strong> ${formatHours(totals.nightHours)}</p>
            <p><strong>Total Heures de Compensation:</strong> ${formatHours(totals.compHours)}</p>
            <p><strong>Total des Heures:</strong> ${formatHours(totals.totalHours)}</p>
        </div>
        <div class="absences-summary">
            <h3>Récapitulatif des Absences</h3>
            ${monthAbsences.length > 0 ? 
                monthAbsences.map(absence => `
                    <p>${absence.employee}: ${getAbsenceTypeName(absence.type)} 
                       du ${formatDate(absence.startDate)}${
                           absence.startDate !== absence.endDate 
                           ? ' au ' + formatDate(absence.endDate)
                           : ''
                       }</p>
                `).join('') 
                : '<p>Aucune absence sur la période</p>'
            }
        </div>
        <div class="signature-line">
            <p>Signature</p>
        </div>
    `;
    printContent.appendChild(footer);

    // Remplacer le contenu de la page et imprimer
    document.body.innerHTML = printContent.outerHTML;
    window.print();

    // Restaurer le contenu original
    document.body.innerHTML = originalContent;
    
    // Réinitialiser les écouteurs d'événements
    setupEventListeners();
    loadData();
    updateDisplay();
}

// Fonction auxiliaire pour obtenir les entrées du mois
function getMonthEntries() {
    const monthSelect = document.getElementById('monthSelect');
    const [year, month] = monthSelect.value.split('-');
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    return timeEntries
        .filter(entry => {
            const entryDate = new Date(entry.date);
            const isInMonth = entryDate >= monthStart && entryDate <= monthEnd;
            return selectedEmployee ? (isInMonth && entry.employee === selectedEmployee) : isInMonth;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Fonction auxiliaire pour calculer les totaux du mois
function calculateMonthTotals(entries) {
    return entries.reduce((acc, entry) => {
        acc.normalHours += entry.normalHours || 0;
        acc.nightHours += entry.nightHours || 0;
        acc.compHours += entry.compensationHours || 0;
        acc.totalHours += entry.totalHours || 0;
        return acc;
    }, { normalHours: 0, nightHours: 0, compHours: 0, totalHours: 0 });
}
