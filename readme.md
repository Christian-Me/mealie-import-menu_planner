# Mealie importer for Menu-Planner recipes

A node.js script to import or updates Menu-Planner recipes into Mealie via the Mealie API.

* tries to match all base data to Mealie (prep Time, cook time, url, servings and rating)
* uses existing units and ingredients. Create new ingredients if necessary.
* support of translation table (units.json) to avoid inaccurate fuzzy search matches.
* uses fuzzy search (fuze.js) to match ingredients, units and for ingredient highlighting (may result in wrong matches)
* splits instructions into steps by paragraphs (as menu planner only supports a singe step)
* Links ingredients to steps and highlights them in the text (Bold)
* uploads included recipe image

## background

I used [Menu Planner](http://mp2.menu-planner.com/) for many years. Unfortunately the development stalled years ago. I only stayed because of my 500+ recipes carefully maintained over the years while looking for an open source alterative with the ability to migrate them. Finally I found one!

## usage

* Install [Node.js](https://nodejs.org)
* Menu Planner seams to only allow you to send a single recipes by mail. There you find an *.mpxr attachment which is a JSON formatted text file with all necessary data. Copy the file into the program folder as `Menu Planner Recipe.mpxr` (all recipes come with the same file name, so simply overwrite the last used). For testing my last import file is included.
* edit `credentials.js.template` with your token and instance url and save it as `credentials.js`
* edit `units.json` to match menu planner units with your language dependent units. (consider sending me your file to include it for other users)
* run the script `npn start` or `node index.js`.
* or convince your mail client of choice to save the attachment to the script folder and start the script.
* Please **refresh the page before editing**! See known issues below.

## outlook users

If you use outlook you may like to automatically save the attachement `Menu Planner Recipe.mpxr` if present and start the script. As I'm not familiar with VBA the AI helped me with this (so use it with caution). Paste this script into `ThisOutlookSession` save and restart outlook. You may have to disable VBA security in options/trust center/macros for all scripts!

```VB
Private WithEvents Items As Outlook.Items

Private Sub Application_Startup()
    Dim Ns As Outlook.NameSpace
    Set Ns = Application.GetNamespace("MAPI")
    Set Items = Ns.GetDefaultFolder(olFolderInbox).Items
End Sub

Private Sub Items_ItemAdd(ByVal Item As Object)
    On Error GoTo ErrorHandler
    Dim MailItem As Outlook.MailItem
    Dim Atmt As Outlook.Attachment
    Dim FileName As String
    Dim SaveFolder As String
    Dim RetVal
    

    SaveFolder = "C:\github\mealie-import-menu_planner\" ' Edit your path where the script is here

    If TypeOf Item Is Outlook.MailItem Then
        Set MailItem = Item
        For Each Atmt In MailItem.Attachments
            If InStr(Atmt.FileName, "Menu Planner Recipe.mpxr") > 0 Then ' This is the default menu planner file name
                FileName = SaveFolder & Atmt.FileName
                Atmt.SaveAsFile FileName
                ShellCommand = "cmd.exe /c cd /d " & SaveFolder & " && node .\index.js"
                RetVal = Shell(ShellCommand, vbNormalFocus) ' start the script
                ' MsgBox "command: '" & ShellCommand & "' returned: " & RetVal
            End If
        Next Atmt
    End If

ProgramExit:
    Exit Sub
ErrorHandler:
    MsgBox "Error: " & Err.Number & " - " & Err.Description
    Resume ProgramExit
End Sub
```

## dependencies

* Axios [npm](https://www.npmjs.com/package/axios) for doing API stuff
* Fuse [npm](https://www.npmjs.com/package/fuse.js) for performing fuzzy searches

## known issus

* only minor error handling implemented.
* I'm not sure what will be overwritten or patched/updated by the API request `PATCH /api/recipes/{slug} Patch One`. So be careful with existing recipes.
* recipes appear in an running session of Mealie by clicking on the menu. When you edit the recipe new ingredients and units will show as empty!. So **refresh the page before editing**
* For newly cerated ingredients and units you have to refresh the page!
* only tested with **German language** and **metric units**!
* perhaps fine tune of fuzzy search is necessary.
* no bulk export from menu planner seams possible.
* last made is not included in the menu planner JSON
* categories are not included in the menu planner JSON

## Example

from this

(select the share button)
![Menu Planner recipe](https://raw.githubusercontent.com/Christian-Me/mealie-import-menu_planner/master/images/mpExample-1.png)

to this
![Mealie recipe](https://raw.githubusercontent.com/Christian-Me/mealie-import-menu_planner/master/images/mealieExample-1.png)

by opening a shell and goto the folder where you installed this script then call `npn start` or `node index.js`:

```powershell
PS C:\github\mealie-import-menu_planner> npm start

> mealie-import-menu_planner@1.0.0 start
> node index.js

Menu Planer to Mealie
---------------------
Calling API for existing recipes ...
 Existing recipes in Mealie: 8
Calling API for existing foods ...
 Existing foods in Mealie: 196
Calling API for existing Units ...
 Existing units in Mealie: 30
Reading MenuPlanner File
Prepare MenuPlanner units: 33
 Name in file "Speck-Zwiebel-Flammkuchen" already existing. Updating!
 fuzzy search for "gram" found 4 results. Best result "Gramm".
Quantity: 15 g (Gramm) name: "Frischhefe" note: ""
 fuzzy search for "gram" found 4 results. Best result "Gramm".
Quantity: 375 g (Gramm) name: "Mehl" note: ""
Quantity: 150 ml (Milliliter) name: "Buttermilch" note: ""
 cannot find menu planner unit!
Quantity: undefined undefined (undefined) name: "Salz" note: ""
Quantity: 4 EL (Esslöffel) name: "Olivenöl" note: ""
 fuzzy search for "gram" found 4 results. Best result "Gramm".
Quantity: 70 g (Gramm) name: "Zwiebel" note: ""
 fuzzy search for "gram" found 4 results. Best result "Gramm".
Quantity: 70 g (Gramm) name: "Zwiebel" note: ""
 fuzzy search for "gram" found 4 results. Best result "Gramm".
Quantity: 120 g (Gramm) name: "Tiroler Speck" note: "in sehr dünnen Scheiben"
 fuzzy search for "gram" found 4 results. Best result "Gramm".
Quantity: 150 g (Gramm) name: "Crème fraîche" note: ""
 fuzzy search for "gram" found 4 results. Best result "Gramm".
Quantity: 200 g (Gramm) name: "Schmand" note: ""
 cannot find menu planner unit!
Quantity: undefined undefined (undefined) name: "Salz" note: ""
 cannot find menu planner unit!
Quantity: undefined undefined (undefined) name: "Pfeffer" note: ""
Quantity: 0.5 TL (Teelöffel) name: "Kümmel" note: ""
 fuzzy search for "Hefe" found 1 results. Best result "Frischhefe" (0.00360).
 fuzzy search for "Mehl" found 1 results. Best result "Mehl" (0.00000).
 fuzzy search for "Mehl" found 1 results. Best result "Mehl" (0.00000).
 fuzzy search for "Buttermilch," found 1 results. Best result "Buttermilch" (0.00694).
 fuzzy search for "Salz" found 2 results. Best result "Salz" (0.00000).
 fuzzy search for "Olivenöl" found 1 results. Best result "Olivenöl" (0.00000).
 fuzzy search for "Speck" found 1 results. Best result "Tiroler Speck" (0.02812).
 fuzzy search for "Crème" found 1 results. Best result "Crème fraîche" (0.00006).
 fuzzy search for "fraîche" found 1 results. Best result "Crème fraîche" (0.01872).
 fuzzy search for "Pfeffer" found 1 results. Best result "Pfeffer" (0.00000).
 fuzzy search for "Kümmel" found 1 results. Best result "Kümmel" (0.00000).
 fuzzy search for "Pfeffer" found 1 results. Best result "Pfeffer" (0.00000).
"speck-zwiebel-flammkuchen" recipe updated! (200 OK)
"speck-zwiebel-flammkuchen" image updated! (200 OK)
finished importing no new recipe(s) 1 updated
```