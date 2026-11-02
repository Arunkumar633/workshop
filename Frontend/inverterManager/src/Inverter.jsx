import React, { useState } from "react";

const MAX_CAPACITY = 800;

function Inverter() {
   const [appliances, setAppliances] = useState([
    
  ]);

  const [name, setName] = useState("");
  const [wattage, setWattage] = useState("");
  const [priority, setPriority] = useState("");

  const [message, setMessage] = useState(
    "System ready. Maximum inverter capacity is 800W."
  );

  const [messageType, setMessageType] = useState("info");

  const [nextShedOrder, setNextShedOrder] = useState(1);

   const getCurrentLoad = (items = appliances) => {
    return items
      .filter((item) => item.state === "running")
      .reduce((total, item) => total + item.wattage, 0);
  };

  const currentLoad = getCurrentLoad();
  const remainingCapacity = MAX_CAPACITY - currentLoad;

  const loadPercentage = Math.min(
    (currentLoad / MAX_CAPACITY) * 100,
    100
  );

  
  const restoreAppliances = (items) => {
    let updated = items.map((item) => ({ ...item }));

    let load = getCurrentLoad(updated);

    const shedItems = updated
      .filter((item) => item.state === "shed")
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }

        return (a.shedOrder || 0) - (b.shedOrder || 0);
      });

    const restoredNames = [];

    for (const shedItem of shedItems) {
      if (load + shedItem.wattage <= MAX_CAPACITY) {
        updated = updated.map((item) =>
          item.id === shedItem.id
            ? {
                ...item,
                state: "running",
                shedOrder: null,
              }
            : item
        );

        load += shedItem.wattage;
        restoredNames.push(shedItem.name);
      }
    }

    return {
      appliances: updated,
      restoredNames,
    };
  };

  
  const addAppliance = (event) => {
    event.preventDefault();

    const applianceName = name.trim();
    const applianceWattage = Number(wattage);
    const appliancePriority = Number(priority);

    if (!applianceName) {
      showError("Please enter the appliance name.");
      return;
    }

    if (!Number.isFinite(applianceWattage) || applianceWattage <= 0) {
      showError("Wattage must be greater than 0.");
      return;
    }

    if (applianceWattage > MAX_CAPACITY) {
      showError(
        `An appliance cannot exceed the inverter's ${MAX_CAPACITY}W capacity.`
      );
      return;
    }

    if (
      !Number.isInteger(appliancePriority) ||
      appliancePriority <= 0
    ) {
      showError("Priority must be a positive whole number.");
      return;
    }

    const newAppliance = {
      id: Date.now(),
      name: applianceName,
      wattage: applianceWattage,
      priority: appliancePriority,
      state: "off",
      shedOrder: null,
    };

    setAppliances((previous) => [
      ...previous,
      newAppliance,
    ]);

    setName("");
    setWattage("");
    setPriority("");

    showSuccess(`${applianceName} registered successfully.`);
  };

  
  const turnOn = (id) => {
    const requested = appliances.find(
      (item) => item.id === id
    );

    if (!requested) {
      return;
    }

    if (requested.state === "running") {
      return;
    }

    const load = getCurrentLoad();

    // Already enough space
    if (load + requested.wattage <= MAX_CAPACITY) {
      setAppliances((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                state: "running",
                shedOrder: null,
              }
            : item
        )
      );

      showSuccess(`${requested.name} turned ON.`);
      return;
    }

    
    const shedCandidates = appliances
      .filter(
        (item) =>
          item.state === "running" &&
          item.priority > requested.priority
      )
      .sort((a, b) => {
        // Shed lowest priority first.
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }

        return b.wattage - a.wattage;
      });

    let projectedLoad = load;
    const toShed = [];

    for (const candidate of shedCandidates) {
      if (
        projectedLoad + requested.wattage <=
        MAX_CAPACITY
      ) {
        break;
      }

      projectedLoad -= candidate.wattage;
      toShed.push(candidate);
    }

    
    if (
      projectedLoad + requested.wattage >
      MAX_CAPACITY
    ) {
      showError(
        `${requested.name} cannot be turned ON. ` +
          `It needs ${requested.wattage}W, but there is not enough lower-priority load available to shed.`
      );

      return;
    }

    
    let order = nextShedOrder;

    const shedIds = new Set(
      toShed.map((item) => item.id)
    );

    const updated = appliances.map((item) => {
      if (item.id === requested.id) {
        return {
          ...item,
          state: "running",
          shedOrder: null,
        };
      }

      if (shedIds.has(item.id)) {
        const updatedItem = {
          ...item,
          state: "shed",
          shedOrder: order,
        };

        order += 1;

        return updatedItem;
      }

      return item;
    });

    setAppliances(updated);
    setNextShedOrder(order);

    const shedNames = toShed
      .map((item) => item.name)
      .join(", ");

    showWarning(
      `${requested.name} turned ON. ` +
        `${shedNames} ${toShed.length === 1 ? "was" : "were"} automatically shed to stay within ${MAX_CAPACITY}W.`
    );
  };

  
  const turnOff = (id) => {
    const requested = appliances.find(
      (item) => item.id === id
    );

    if (!requested) {
      return;
    }

    const turnedOff = appliances.map((item) =>
      item.id === id
        ? {
            ...item,
            state: "off",
            shedOrder: null,
          }
        : item
    );

    // Capacity may now be available.
    const result = restoreAppliances(turnedOff);

    setAppliances(result.appliances);

    if (result.restoredNames.length > 0) {
      showSuccess(
        `${requested.name} turned OFF. ` +
          `Automatically restored: ${result.restoredNames.join(", ")}.`
      );
    } else {
      showSuccess(`${requested.name} turned OFF.`);
    }
  };

 
  const deleteAppliance = (id) => {
    const requested = appliances.find(
      (item) => item.id === id
    );

    if (!requested) {
      return;
    }

    const remaining = appliances.filter(
      (item) => item.id !== id
    );

    // Deleting a running appliance can free capacity.
    const result = restoreAppliances(remaining);

    setAppliances(result.appliances);

    if (result.restoredNames.length > 0) {
      showSuccess(
        `${requested.name} deleted. ` +
          `Automatically restored: ${result.restoredNames.join(", ")}.`
      );
    } else {
      showSuccess(`${requested.name} deleted.`);
    }
  };

  
  const showSuccess = (text) => {
    setMessage(text);
    setMessageType("success");
  };

  const showError = (text) => {
    setMessage(text);
    setMessageType("error");
  };

  const showWarning = (text) => {
    setMessage(text);
    setMessageType("warning");
  };

  
  const stateColour = (state) => {
    if (state === "running") {
      return "#16a34a";
    }

    if (state === "shed") {
      return "#d97706";
    }

    return "#64748b";
  };

  const stateBackground = (state) => {
    if (state === "running") {
      return "#dcfce7";
    }

    if (state === "shed") {
      return "#fef3c7";
    }

    return "#f1f5f9";
  };

  const getMessageStyle = () => {
    if (messageType === "error") {
      return {
        backgroundColor: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fecaca",
      };
    }

    if (messageType === "warning") {
      return {
        backgroundColor: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fde68a",
      };
    }

    return {
      backgroundColor: "#dcfce7",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  };

 
  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}

        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>
              Home Inverter Manager
            </h1>

            <p style={styles.subtitle}>
              Priority-based smart power management
            </p>
          </div>

          <div style={styles.limit}>
            {MAX_CAPACITY}W MAX
          </div>
        </div>

        {/* MESSAGE */}

        {message && (
          <div
            style={{
              ...styles.message,
              ...getMessageStyle(),
            }}
          >
            <span>{message}</span>

            <button
              type="button"
              onClick={() => setMessage("")}
              style={styles.messageClose}
            >
              ×
            </button>
          </div>
        )}

        {/* CAPACITY */}

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Power Capacity
          </h2>

          <div style={styles.capacityGrid}>
            <div style={styles.capacityBox}>
              <div style={styles.capacityNumber}>
                {currentLoad}W
              </div>

              <div style={styles.capacityLabel}>
                Power Used
              </div>
            </div>

            <div style={styles.capacityBox}>
              <div
                style={{
                  ...styles.capacityNumber,
                  color: "#16a34a",
                }}
              >
                {remainingCapacity}W
              </div>

              <div style={styles.capacityLabel}>
                Power Free
              </div>
            </div>

            <div style={styles.capacityBox}>
              <div style={styles.capacityNumber}>
                {MAX_CAPACITY}W
              </div>

              <div style={styles.capacityLabel}>
                Maximum
              </div>
            </div>
          </div>

          {/* CAPACITY BAR */}

          <div style={styles.progressOuter}>
            <div
              style={{
                ...styles.progressInner,
                width: `${loadPercentage}%`,
                backgroundColor:
                  loadPercentage >= 90
                    ? "#dc2626"
                    : loadPercentage >= 70
                    ? "#f59e0b"
                    : "#16a34a",
              }}
            />
          </div>

          <div style={styles.progressText}>
            {Math.round(loadPercentage)}% capacity used
          </div>
        </div>

        {/* ADD APPLIANCE */}

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Register Appliance
          </h2>

          <form
            onSubmit={addAppliance}
            style={styles.form}
          >
            <div style={styles.field}>
              <label style={styles.label}>
                Appliance Name
              </label>

              <input
                style={styles.input}
                value={name}
                placeholder="e.g. Fridge"
                onChange={(event) =>
                  setName(event.target.value)
                }
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Wattage
              </label>

              <input
                type="number"
                min="1"
                max="800"
                style={styles.input}
                value={wattage}
                placeholder="300"
                onChange={(event) =>
                  setWattage(event.target.value)
                }
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Priority
              </label>

              <input
                type="number"
                min="1"
                style={styles.input}
                value={priority}
                placeholder="1"
                onChange={(event) =>
                  setPriority(event.target.value)
                }
              />
            </div>

            <button
              type="submit"
              style={styles.addButton}
            >
              + Add Appliance
            </button>
          </form>

          <div style={styles.hint}>
            Priority 1 is the highest priority. Higher
            numbers have lower priority.
          </div>
        </div>

        {/* APPLIANCES */}

        <div style={styles.card}>
          <div style={styles.listHeader}>
            <h2
              style={{
                ...styles.sectionTitle,
                marginBottom: 0,
              }}
            >
              Appliances
            </h2>

            <span style={styles.count}>
              {appliances.length} registered
            </span>
          </div>

          {appliances.length === 0 ? (
            <div style={styles.empty}>
              No appliances registered.
            </div>
          ) : (
            <div style={styles.grid}>
              {appliances.map((appliance) => (
                <div
                  key={appliance.id}
                  style={{
                    ...styles.applianceCard,
                    borderLeft: `5px solid ${stateColour(
                      appliance.state
                    )}`,
                  }}
                >
                  <div style={styles.applianceHeader}>
                    <div>
                      <h3 style={styles.applianceName}>
                        {appliance.name}
                      </h3>

                      <div style={styles.wattage}>
                        {appliance.wattage}W
                      </div>
                    </div>

                    <span
                      style={{
                        ...styles.badge,
                        color: stateColour(
                          appliance.state
                        ),
                        backgroundColor:
                          stateBackground(
                            appliance.state
                          ),
                      }}
                    >
                      ● {appliance.state.toUpperCase()}
                    </span>
                  </div>

                  <div style={styles.details}>
                    <span>
                      Priority
                    </span>

                    <strong>
                      P{appliance.priority}
                    </strong>
                  </div>

                  {appliance.state === "shed" && (
                    <div style={styles.shedMessage}>
                      ⚠ Waiting for available capacity.
                      This appliance will be restored
                      automatically.
                    </div>
                  )}

                  <div style={styles.actions}>
                    {appliance.state ===
                    "running" ? (
                      <button
                        style={styles.offButton}
                        onClick={() =>
                          turnOff(appliance.id)
                        }
                      >
                        Turn OFF
                      </button>
                    ) : appliance.state ===
                      "shed" ? (
                      <button
                        style={styles.cancelButton}
                        onClick={() =>
                          turnOff(appliance.id)
                        }
                      >
                        Cancel Request
                      </button>
                    ) : (
                      <button
                        style={styles.onButton}
                        onClick={() =>
                          turnOn(appliance.id)
                        }
                      >
                        Turn ON
                      </button>
                    )}

                    <button
                      style={styles.deleteButton}
                      onClick={() =>
                        deleteAppliance(appliance.id)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LEGEND */}

        <div style={styles.legend}>
          <span style={{ color: "#16a34a" }}>
            ● Running
          </span>

          <span style={{ color: "#64748b" }}>
            ● Off
          </span>

          <span style={{ color: "#d97706" }}>
            ● Shed
          </span>
        </div>
      </div>
    </div>
  );
}



const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    fontFamily:
      "Inter, Arial, Helvetica, sans-serif",
    color: "#0f172a",
    padding: "32px 20px",
  },

  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },

  title: {
    margin: 0,
    fontSize: "30px",
  },

  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
  },

  limit: {
    backgroundColor: "#0f172a",
    color: "white",
    padding: "10px 16px",
    borderRadius: "20px",
    fontWeight: "bold",
  },

  card: {
    backgroundColor: "white",
    padding: "24px",
    borderRadius: "14px",
    boxShadow: "0 3px 12px rgba(0,0,0,0.06)",
    marginBottom: "20px",
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "20px",
  },

  message: {
    padding: "14px 16px",
    borderRadius: "10px",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  messageClose: {
    border: "none",
    background: "transparent",
    fontSize: "20px",
    cursor: "pointer",
  },

  capacityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "15px",
    marginBottom: "20px",
  },

  capacityBox: {
    padding: "18px",
    backgroundColor: "#f8fafc",
    borderRadius: "10px",
    textAlign: "center",
  },

  capacityNumber: {
    fontWeight: "bold",
    fontSize: "26px",
  },

  capacityLabel: {
    color: "#64748b",
    marginTop: "5px",
    fontSize: "13px",
  },

  progressOuter: {
    width: "100%",
    height: "18px",
    borderRadius: "20px",
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },

  progressInner: {
    height: "100%",
    borderRadius: "20px",
    transition: "width 0.3s ease",
  },

  progressText: {
    textAlign: "center",
    marginTop: "9px",
    color: "#64748b",
    fontSize: "13px",
  },

  form: {
    display: "flex",
    gap: "12px",
    alignItems: "end",
    flexWrap: "wrap",
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    flex: "1 1 160px",
  },

  label: {
    fontWeight: "600",
    fontSize: "13px",
  },

  input: {
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    outline: "none",
    fontSize: "14px",
  },

  addButton: {
    padding: "12px 18px",
    border: "none",
    backgroundColor: "#2563eb",
    color: "white",
    borderRadius: "7px",
    cursor: "pointer",
    fontWeight: "600",
  },

  hint: {
    marginTop: "12px",
    color: "#64748b",
    fontSize: "12px",
  },

  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },

  count: {
    color: "#64748b",
    fontSize: "13px",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },

  applianceCard: {
    padding: "18px",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
  },

  applianceHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
  },

  applianceName: {
    margin: 0,
    fontSize: "19px",
  },

  wattage: {
    fontSize: "24px",
    fontWeight: "bold",
    marginTop: "7px",
    color: "#334155",
  },

  badge: {
    padding: "6px 9px",
    borderRadius: "20px",
    fontWeight: "bold",
    fontSize: "11px",
  },

  details: {
    display: "flex",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderRadius: "7px",
    padding: "10px",
    margin: "16px 0",
  },

  shedMessage: {
    padding: "10px",
    backgroundColor: "#fffbeb",
    color: "#92400e",
    borderRadius: "7px",
    fontSize: "12px",
    marginBottom: "14px",
  },

  actions: {
    display: "flex",
    gap: "8px",
  },

  onButton: {
    flex: 1,
    border: "none",
    backgroundColor: "#16a34a",
    color: "white",
    padding: "10px",
    borderRadius: "7px",
    cursor: "pointer",
    fontWeight: "600",
  },

  offButton: {
    flex: 1,
    border: "none",
    backgroundColor: "#f59e0b",
    color: "white",
    padding: "10px",
    borderRadius: "7px",
    cursor: "pointer",
    fontWeight: "600",
  },

  cancelButton: {
    flex: 1,
    border: "none",
    backgroundColor: "#d97706",
    color: "white",
    padding: "10px",
    borderRadius: "7px",
    cursor: "pointer",
    fontWeight: "600",
  },

  deleteButton: {
    border: "none",
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    padding: "10px 14px",
    borderRadius: "7px",
    cursor: "pointer",
    fontWeight: "600",
  },

  empty: {
    textAlign: "center",
    padding: "40px",
    color: "#64748b",
  },

  legend: {
    display: "flex",
    justifyContent: "center",
    gap: "25px",
    padding: "10px",
    fontSize: "13px",
    fontWeight: "600",
  },
};

export default Inverter;