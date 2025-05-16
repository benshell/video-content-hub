import os
DATA_HOME = os.getenv("DATA_HOME", "data")

def create_folder(folder):
    folder_path = os.path.join(DATA_HOME, folder)
    try:
        os.makedirs(folder_path, exist_ok=True)
        print(f"Folder '{folder_path}' created successfully.")
        return folder_path
    except FileExistsError:
        print(f"Folder '{folder_path}' already exists.")
        raise
    except Exception as e:
        print(f"An error occurred: {e}")
        raise
