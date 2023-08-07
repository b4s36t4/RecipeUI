import { useEffect } from "react";
import { useInterval, useLocalStorage } from "usehooks-ts";
import {
  LocalStorageState,
  SESSION_HYDRATION_KEY,
  getEmptyParameters,
  useRecipeSessionStore,
  GLOBAL_POLLING_FACTOR,
} from "./recipeSession";
import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "@/utils/constants";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Database } from "@/types/database.types";
import { Recipe } from "@/types/databaseExtended";

/*
This is definitely a naive, unoptimized, approach to storing data locally.

Basically, save everything relevant to use every GLOBAL_POLLING_FACTOR seconds.
*/

export function useSaveRecipeUI() {
  const [localSave, setLocalSave] = useLocalStorage<LocalStorageState | null>(
    SESSION_HYDRATION_KEY,
    {
      currentSession: null,
      sessions: [],
      ...getEmptyParameters(),
    }
  );

  const sessions = useRecipeSessionStore((state) => state.sessions);
  const currentSession = useRecipeSessionStore((state) => state.currentSession);
  const setSessions = useRecipeSessionStore((state) => state.setSessions);
  const setCurrentSession = useRecipeSessionStore(
    (state) => state.setCurrentSession
  );
  const setRequestBody = useRecipeSessionStore((state) => state.setRequestBody);
  const requestBody = useRecipeSessionStore((state) => state.requestBody);
  const queryParams = useRecipeSessionStore((state) => state.queryParams);
  const setQueryParams = useRecipeSessionStore((state) => state.setQueryParams);
  const urlParams = useRecipeSessionStore((state) => state.urlParams);
  const setUrlParams = useRecipeSessionStore((state) => state.setUrlParams);

  // On mount, hydrate from local storage
  useEffect(() => {
    console.log("Hydrating from local storage");

    if (!localSave) return;
    if (localSave.currentSession) setCurrentSession(localSave.currentSession);
    if (localSave.sessions) setSessions(localSave.sessions);
    if (localSave.requestBody) setRequestBody(localSave.requestBody);
    if (localSave.queryParams) setQueryParams(localSave.queryParams);
    if (localSave.urlParams) setUrlParams(localSave.urlParams);
  }, []);

  const supabase = createClientComponentClient<Database>();
  const initializeRecipes = useRecipeSessionStore(
    (state) => state.initializeRecipes
  );
  useEffect(() => {
    async function fetchRecipes() {
      const res = await supabase.from("recipe").select("*");
      const newRecipes = res.data as unknown[] as Recipe[];
      if (res.data) {
        initializeRecipes(newRecipes);
      }

      if (!localSave) return null;
      // Lets fix all the sessions and the current session
      // This is not really ideal right now, we should really be referencing ids and then matching later

      let _sessions = localSave.sessions.map((session) => {
        const latestRecipe = newRecipes.find(
          (_recipe) => _recipe.id === session.recipe.id
        );

        if (latestRecipe) {
          return {
            ...session,
            recipe: latestRecipe,
          };
        }

        return session;
      });
      setSessions(_sessions);

      const localSession = localSave.currentSession;
      if (localSession != null) {
        const latestRecipe = newRecipes.find(
          (_recipe) => _recipe.id === localSession.recipe.id
        );

        if (localSave.currentSession && latestRecipe) {
          setCurrentSession({
            ...localSession,
            recipe: latestRecipe,
          });
        }
      }
    }
    fetchRecipes();
  }, []);

  // Save changes every POLLING_FACTOR seconds
  useInterval(() => {
    setLocalSave({
      currentSession,
      sessions,
      requestBody,
      queryParams,
      urlParams,
    });
  }, GLOBAL_POLLING_FACTOR);
}
