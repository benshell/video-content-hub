import os
from urllib.parse import urlparse, parse_qs
from contextlib import suppress

DATA_HOME = os.getenv("DATA_HOME", "data")

def create_folder(folder):
    folder_path = os.path.join(DATA_HOME, folder)
    try:
        os.makedirs(folder_path, exist_ok=True)
        return folder_path
    except FileExistsError:
        print(f"Folder '{folder_path}' already exists.")
        raise
    except Exception as e:
        print(f"An error occurred: {e}")
        raise

def get_all_files_in_folder(folder_path):
  """
  Gets a list of all files in a folder, including those in subfolders.

  Args:
    folder_path: The path to the folder.

  Returns:
    A list of file paths.
  """
  file_paths = []
  for root, _, files in os.walk(folder_path):
    for file in files:
      file_path = os.path.join(root, file)
      file_paths.append(file_path)
  return file_paths

def get_youtube_id(url, ignore_playlist=False):
    # Examples:
    # - http://youtu.be/SA2iWivDJiE
    # - http://www.youtube.com/watch?v=_oPAwA_Udwc&feature=feedu
    # - http://www.youtube.com/embed/SA2iWivDJiE
    # - http://www.youtube.com/v/SA2iWivDJiE?version=3&amp;hl=en_US
    query = urlparse(url)
    if query.hostname == 'youtu.be': return query.path[1:]
    if query.hostname in {'www.youtube.com', 'youtube.com', 'music.youtube.com'}:
        if not ignore_playlist:
        # use case: get playlist id not current video in playlist
            with suppress(KeyError):
                return parse_qs(query.query)['list'][0]
        if query.path == '/watch': return parse_qs(query.query)['v'][0]
        if query.path[:7] == '/watch/': return query.path.split('/')[2]
        if query.path[:7] == '/embed/': return query.path.split('/')[2]
        if query.path[:3] == '/v/': return query.path.split('/')[2]
   # returns None for invalid YouTube url
