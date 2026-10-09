import { useStoreApi } from "@/workspace/StoreScope";
import { useEffect, useState } from "react";
import { jsonRequest } from "@/api/store";
import { useStore } from "@/hooks/useStore";

export default function useSettingsEditor(notify) {
  const api = useStoreApi();
  const { setStore } = useStore();
  const [value, setValue] = useState(null),
    [baseline, setBaseline] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dirty = value !== null && JSON.stringify(value) !== baseline;
  const accept = (data) => {
    setValue(data);
    setBaseline(JSON.stringify(data));
  };
  const reload = () =>
    api("/admin/store")
      .then((data) => {
        accept(data);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    let current = true;
    api("/admin/store")
      .then((data) => {
        if (current) accept(data);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [api]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("/admin/store", jsonRequest("PUT", value));
      accept(data);
      setStore(data);
      notify("Changes saved to your store.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return { value, setValue, error, setError, busy, dirty, reload, save };
}
